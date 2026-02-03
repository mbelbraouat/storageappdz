import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Thermometer, 
  Plus, 
  Edit,
  Trash2,
  Loader2,
  FlaskConical,
  Clock,
  Gauge
} from 'lucide-react';

interface Technique {
  id: string;
  name: string;
  code: string;
  description: string | null;
  temperature: number | null;
  pressure: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

const SterilizationTechniques = () => {
  const { toast } = useToast();

  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTechnique, setEditingTechnique] = useState<Technique | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    temperature: '',
    pressure: '',
    duration_minutes: '',
    is_active: true,
  });

  useEffect(() => {
    fetchTechniques();
  }, []);

  const fetchTechniques = async () => {
    try {
      const { data, error } = await supabase
        .from('sterilization_techniques')
        .select('*')
        .order('name');

      if (error) throw error;
      setTechniques(data || []);
    } catch (error) {
      console.error('Error fetching techniques:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les techniques', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (technique?: Technique) => {
    if (technique) {
      setEditingTechnique(technique);
      setForm({
        name: technique.name,
        code: technique.code,
        description: technique.description || '',
        temperature: technique.temperature?.toString() || '',
        pressure: technique.pressure?.toString() || '',
        duration_minutes: technique.duration_minutes?.toString() || '',
        is_active: technique.is_active,
      });
    } else {
      setEditingTechnique(null);
      setForm({
        name: '',
        code: '',
        description: '',
        temperature: '',
        pressure: '',
        duration_minutes: '',
        is_active: true,
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Erreur', description: 'Nom et code requis', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        description: form.description.trim() || null,
        temperature: form.temperature ? parseFloat(form.temperature) : null,
        pressure: form.pressure ? parseFloat(form.pressure) : null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        is_active: form.is_active,
      };

      if (editingTechnique) {
        const { error } = await supabase
          .from('sterilization_techniques')
          .update(data)
          .eq('id', editingTechnique.id);
        if (error) throw error;
        toast({ title: 'Technique mise à jour' });
      } else {
        const { error } = await supabase
          .from('sterilization_techniques')
          .insert(data);
        if (error) throw error;
        toast({ title: 'Technique créée' });
      }

      setShowDialog(false);
      fetchTechniques();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (technique: Technique) => {
    if (!confirm(`Supprimer la technique "${technique.name}" ?`)) return;

    try {
      const { error } = await supabase
        .from('sterilization_techniques')
        .delete()
        .eq('id', technique.id);

      if (error) throw error;
      toast({ title: 'Technique supprimée' });
      fetchTechniques();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (technique: Technique) => {
    try {
      const { error } = await supabase
        .from('sterilization_techniques')
        .update({ is_active: !technique.is_active })
        .eq('id', technique.id);

      if (error) throw error;
      toast({ title: technique.is_active ? 'Technique désactivée' : 'Technique activée' });
      fetchTechniques();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FlaskConical className="w-7 h-7 text-primary" />
              Techniques de Stérilisation
            </h1>
            <p className="text-muted-foreground mt-1">
              Configurez les méthodes de stérilisation disponibles
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle technique
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : techniques.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">Aucune technique configurée</p>
                <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une technique
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Technique</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Température</TableHead>
                    <TableHead>Pression</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techniques.map((technique) => (
                    <TableRow key={technique.id} className={!technique.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{technique.name}</p>
                          {technique.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {technique.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {technique.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        {technique.temperature ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Thermometer className="w-3 h-3" />
                            {technique.temperature}°C
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {technique.pressure ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Gauge className="w-3 h-3" />
                            {technique.pressure} bar
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {technique.duration_minutes ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3" />
                            {technique.duration_minutes} min
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={technique.is_active}
                          onCheckedChange={() => handleToggleActive(technique)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleOpenDialog(technique)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(technique)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
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
                {editingTechnique ? 'Modifier la technique' : 'Nouvelle technique'}
              </DialogTitle>
              <DialogDescription>
                {editingTechnique ? 'Modifiez les paramètres' : 'Configurez une nouvelle méthode de stérilisation'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Stérilisation à vapeur"
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  placeholder="Ex: vapeur"
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Température (°C)</Label>
                  <Input
                    type="number"
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                    placeholder="134"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pression (bar)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.pressure}
                    onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                    placeholder="2.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Durée (min)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    placeholder="18"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description de la méthode..."
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Technique active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingTechnique ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default SterilizationTechniques;
