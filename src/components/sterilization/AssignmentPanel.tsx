import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Send, 
  RotateCcw, 
  Loader2,
  CheckCircle2,
  Clock,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { type InstrumentBox, STATUS_LABELS } from './BoxCard';

interface Service {
  id: string;
  name: string;
  code: string;
}

interface Assignment {
  id: string;
  box_id: string;
  service_id: string;
  bloc_operatoire: string | null;
  requested_at: string;
  assigned_at: string | null;
  returned_at: string | null;
  status: 'requested' | 'assigned' | 'in_use' | 'returned';
  notes: string | null;
  box?: InstrumentBox;
  service?: Service;
}

interface AssignmentPanelProps {
  sterileBoxes: InstrumentBox[];
  onAssignmentChange: () => void;
}

const AssignmentPanel = ({ sterileBoxes, onAssignmentChange }: AssignmentPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [blocOperatoire, setBlocOperatoire] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, assignmentsRes] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true).order('name'),
        supabase
          .from('box_assignments')
          .select('*, box:instrument_boxes(*), service:services(*)')
          .in('status', ['requested', 'assigned', 'in_use'])
          .order('requested_at', { ascending: false }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      setServices(servicesRes.data || []);
      setAssignments((assignmentsRes.data as unknown as Assignment[]) || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedBoxId || !selectedServiceId || !user) {
      toast({
        title: 'Erreur',
        description: 'Sélectionnez une boîte et un service',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Create assignment
      const { error: assignError } = await supabase.from('box_assignments').insert({
        box_id: selectedBoxId,
        service_id: selectedServiceId,
        bloc_operatoire: blocOperatoire.trim() || null,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
      });

      if (assignError) throw assignError;

      // Update box
      const { error: boxError } = await supabase
        .from('instrument_boxes')
        .update({
          assigned_service_id: selectedServiceId,
          assigned_bloc: blocOperatoire.trim() || null,
          status: 'in_use',
          current_step: 'distribution',
        })
        .eq('id', selectedBoxId);

      if (boxError) throw boxError;

      toast({ title: 'Boîte affectée', description: 'La boîte a été assignée au service' });

      // Reset form
      setSelectedBoxId('');
      setSelectedServiceId('');
      setBlocOperatoire('');
      fetchData();
      onAssignmentChange();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async (assignment: Assignment) => {
    if (!user) return;

    setIsProcessing(true);
    try {
      // Update assignment
      const { error: assignError } = await supabase
        .from('box_assignments')
        .update({
          status: 'returned',
          returned_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);

      if (assignError) throw assignError;

      // Reset box to dirty for new cycle
      const { error: boxError } = await supabase
        .from('instrument_boxes')
        .update({
          assigned_service_id: null,
          assigned_bloc: null,
          status: 'dirty',
          current_step: 'reception',
        })
        .eq('id', assignment.box_id);

      if (boxError) throw boxError;

      toast({ title: 'Boîte retournée', description: 'Prête pour un nouveau cycle' });
      fetchData();
      onAssignmentChange();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600"><Clock className="w-3 h-3 mr-1" />Demandé</Badge>;
      case 'assigned':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600"><Send className="w-3 h-3 mr-1" />Affecté</Badge>;
      case 'in_use':
        return <Badge variant="outline" className="bg-primary/10 text-primary"><Package className="w-3 h-3 mr-1" />En utilisation</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Assignment Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-primary" />
            Affecter une boîte
          </CardTitle>
          <CardDescription>
            Assignez une boîte stérile à un service/bloc opératoire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Boîte stérile</Label>
              <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {sterileBoxes.length === 0 ? (
                    <SelectItem value="_none" disabled>Aucune boîte stérile disponible</SelectItem>
                  ) : (
                    sterileBoxes.map((box) => (
                      <SelectItem key={box.id} value={box.id}>
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {box.name} ({box.box_code})
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bloc opératoire (optionnel)</Label>
              <Input
                value={blocOperatoire}
                onChange={(e) => setBlocOperatoire(e.target.value)}
                placeholder="Ex: Bloc A, Salle 3..."
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleAssign}
                disabled={isProcessing || !selectedBoxId || !selectedServiceId}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Affecter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Affectations en cours</CardTitle>
          <CardDescription>
            {assignments.length} boîte(s) actuellement affectée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune affectation en cours</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Boîte</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Bloc</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{assignment.box?.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {assignment.box?.box_code}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{assignment.service?.name}</Badge>
                    </TableCell>
                    <TableCell>
                      {assignment.bloc_operatoire || '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(assignment.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(assignment.requested_at), 'dd/MM HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReturn(assignment)}
                        disabled={isProcessing}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Retour
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignmentPanel;
