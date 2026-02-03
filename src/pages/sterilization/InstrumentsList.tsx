import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Wrench, 
  Plus, 
  Search,
  Loader2,
  Edit,
  Trash2,
  User,
  Box,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Instrument {
  id: string;
  name: string;
  instrument_code: string;
  description: string | null;
  box_id: string | null;
  status: string;
  condition: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  box?: { name: string; box_code: string } | null;
  creator?: { full_name: string } | null;
}

interface InstrumentBox {
  id: string;
  name: string;
  box_code: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  dirty: { label: 'Sale', color: 'bg-destructive/10 text-destructive' },
  cleaning: { label: 'Nettoyage', color: 'bg-blue-500/10 text-blue-600' },
  ready_for_sterilization: { label: 'Prêt', color: 'bg-amber-500/10 text-amber-600' },
  sterilizing: { label: 'Stérilisation', color: 'bg-violet-500/10 text-violet-600' },
  sterile: { label: 'Stérile', color: 'bg-emerald-500/10 text-emerald-600' },
  in_use: { label: 'En utilisation', color: 'bg-slate-500/10 text-slate-600' },
};

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  good: { label: 'Bon état', color: 'bg-emerald-500/10 text-emerald-600' },
  worn: { label: 'Usé', color: 'bg-amber-500/10 text-amber-600' },
  damaged: { label: 'Endommagé', color: 'bg-destructive/10 text-destructive' },
};

const InstrumentsList = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [boxes, setBoxes] = useState<InstrumentBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  // Dialog states
  const [showDialog, setShowDialog] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    instrumentCode: '',
    description: '',
    boxId: '',
    condition: 'good',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch instruments with box and creator info
      const { data: instrumentsData, error: instrumentsError } = await supabase
        .from('instruments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (instrumentsError) throw instrumentsError;

      // Fetch boxes for the dropdown
      const { data: boxesData, error: boxesError } = await supabase
        .from('instrument_boxes')
        .select('id, name, box_code')
        .eq('is_active', true)
        .order('name');

      if (boxesError) throw boxesError;

      // Enrich instruments with box and creator info
      if (instrumentsData && instrumentsData.length > 0) {
        const boxIds = [...new Set(instrumentsData.map(i => i.box_id).filter(Boolean))];
        const creatorIds = [...new Set(instrumentsData.map(i => i.created_by).filter(Boolean))];

        // Fetch related boxes
        let boxMap = new Map<string, { name: string; box_code: string }>();
        if (boxIds.length > 0) {
          const { data: boxesInfo } = await supabase
            .from('instrument_boxes')
            .select('id, name, box_code')
            .in('id', boxIds);
          boxMap = new Map(boxesInfo?.map(b => [b.id, { name: b.name, box_code: b.box_code }]) || []);
        }

        // Fetch creator profiles
        let creatorMap = new Map<string, string>();
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', creatorIds);
          creatorMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        }

        setInstruments(instrumentsData.map(i => ({
          ...i,
          box: i.box_id ? boxMap.get(i.box_id) || null : null,
          creator: i.created_by ? { full_name: creatorMap.get(i.created_by) || 'Inconnu' } : null,
        })));
      } else {
        setInstruments([]);
      }

      setBoxes(boxesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (instrument?: Instrument) => {
    if (instrument) {
      setEditingInstrument(instrument);
      setForm({
        name: instrument.name,
        instrumentCode: instrument.instrument_code,
        description: instrument.description || '',
        boxId: instrument.box_id || '',
        condition: instrument.condition || 'good',
      });
    } else {
      setEditingInstrument(null);
      setForm({ name: '', instrumentCode: '', description: '', boxId: '', condition: 'good' });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.instrumentCode.trim()) {
      toast({ title: 'Erreur', description: 'Nom et code requis', variant: 'destructive' });
      return;
    }

    if (!form.boxId) {
      toast({ title: 'Erreur', description: 'Une boîte est obligatoire', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        instrument_code: form.instrumentCode.trim(),
        description: form.description.trim() || null,
        box_id: form.boxId,
        condition: form.condition,
      };

      if (editingInstrument) {
        const { error } = await supabase.from('instruments').update(data).eq('id', editingInstrument.id);
        if (error) throw error;
        toast({ title: 'Instrument mis à jour' });
      } else {
        const { error } = await supabase.from('instruments').insert({
          ...data,
          created_by: user?.id,
        });
        if (error) throw error;
        toast({ title: 'Instrument créé' });
      }

      setShowDialog(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (instrument: Instrument) => {
    if (!confirm(`Supprimer l'instrument "${instrument.name}" ?`)) return;

    try {
      const { error } = await supabase
        .from('instruments')
        .update({ is_active: false })
        .eq('id', instrument.id);

      if (error) throw error;
      toast({ title: 'Instrument supprimé' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const filteredInstruments = instruments.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.instrument_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.box?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesCondition = conditionFilter === 'all' || i.condition === conditionFilter;
    return matchesSearch && matchesStatus && matchesCondition;
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Wrench className="w-7 h-7 text-primary" />
              Liste des Instruments
            </h1>
            <p className="text-muted-foreground mt-1">
              {instruments.length} instruments enregistrés
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvel instrument
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, code ou boîte..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="État" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous états</SelectItem>
                  {Object.entries(CONDITION_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredInstruments.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">Aucun instrument trouvé</p>
                {isAdmin && (
                  <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer un instrument
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Boîte</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead>Date création</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstruments.map((instrument) => (
                    <TableRow key={instrument.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{instrument.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {instrument.instrument_code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {instrument.box ? (
                          <div className="flex items-center gap-2">
                            <Box className="w-4 h-4 text-muted-foreground" />
                            <span>{instrument.box.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_LABELS[instrument.status]?.color || ''}>
                          {STATUS_LABELS[instrument.status]?.label || instrument.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CONDITION_LABELS[instrument.condition]?.color || ''}>
                          {CONDITION_LABELS[instrument.condition]?.label || instrument.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {instrument.creator ? (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {instrument.creator.full_name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(instrument.created_at), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleOpenDialog(instrument)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(instrument)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingInstrument ? 'Modifier l\'instrument' : 'Nouvel instrument'}
              </DialogTitle>
              <DialogDescription>
                {editingInstrument ? 'Modifiez les informations' : 'Créez un nouvel instrument'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Pince hémostatique"
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={form.instrumentCode}
                  onChange={(e) => setForm({ ...form, instrumentCode: e.target.value.toUpperCase() })}
                  placeholder="Ex: INST-001"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Boîte d'appartenance *</Label>
                <Select 
                  value={form.boxId} 
                  onValueChange={(v) => setForm({ ...form, boxId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une boîte (obligatoire)" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxes.map((box) => (
                      <SelectItem key={box.id} value={box.id}>
                        {box.name} ({box.box_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>État</Label>
                <Select 
                  value={form.condition} 
                  onValueChange={(v) => setForm({ ...form, condition: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="good">Bon état</SelectItem>
                    <SelectItem value="worn">Usé</SelectItem>
                    <SelectItem value="damaged">Endommagé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description optionnelle..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingInstrument ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default InstrumentsList;
