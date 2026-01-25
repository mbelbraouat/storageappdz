import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Loader2
} from 'lucide-react';

interface OperationActe {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const OperationsManagement = () => {
  const { toast } = useToast();
  const [operations, setOperations] = useState<OperationActe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingOp, setEditingOp] = useState<OperationActe | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchOperations();
  }, []);

  const fetchOperations = async () => {
    try {
      const { data, error } = await supabase
        .from('operation_actes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOperations(data || []);
    } catch (error) {
      console.error('Error fetching operations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (op?: OperationActe) => {
    if (op) {
      setEditingOp(op);
      setFormData({
        name: op.name,
        description: op.description || '',
      });
    } else {
      setEditingOp(null);
      setFormData({ name: '', description: '' });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Operation name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const opData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      };

      if (editingOp) {
        const { error } = await supabase
          .from('operation_actes')
          .update(opData)
          .eq('id', editingOp.id);

        if (error) throw error;
        toast({ title: 'Operation updated', description: 'Operation has been updated.' });
      } else {
        const { error } = await supabase
          .from('operation_actes')
          .insert(opData);

        if (error) throw error;
        toast({ title: 'Operation added', description: 'New operation has been added.' });
      }

      setShowDialog(false);
      fetchOperations();
    } catch (error: any) {
      console.error('Error saving operation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save operation',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (op: OperationActe) => {
    if (!confirm(`Are you sure you want to delete "${op.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('operation_actes')
        .update({ is_active: false })
        .eq('id', op.id);

      if (error) throw error;
      toast({ title: 'Operation deleted', description: 'Operation has been removed.' });
      fetchOperations();
    } catch (error: any) {
      console.error('Error deleting operation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete operation',
        variant: 'destructive',
      });
    }
  };

  const filteredOperations = operations.filter(op =>
    op.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FileText className="w-7 h-7 text-primary" />
              Operations Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage operation types for archive records
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Operation
          </Button>
        </div>

        {/* Search */}
        <div className="card-stats">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search operations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Operations List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading operations...</div>
        ) : filteredOperations.length === 0 ? (
          <div className="card-stats text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No operations found</p>
            {!searchQuery && (
              <Button onClick={() => handleOpenDialog()} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Add First Operation
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOperations.map((op) => (
              <div key={op.id} className="card-stats">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-info" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{op.name}</h3>
                      {op.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {op.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(op)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(op)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingOp ? 'Edit Operation' : 'Add New Operation'}
            </DialogTitle>
            <DialogDescription>
              {editingOp 
                ? 'Update the operation information below.'
                : 'Enter the operation details to add it to the system.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Operation Name *</Label>
              <Input
                id="name"
                placeholder="Enter operation name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter operation description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingOp ? 'Update' : 'Add Operation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default OperationsManagement;
