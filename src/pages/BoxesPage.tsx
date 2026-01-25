import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import CapacityIndicator from '@/components/ui/CapacityIndicator';
import { 
  Box, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  QrCode,
  MapPin,
  Loader2
} from 'lucide-react';

interface ArchiveBox {
  id: string;
  name: string;
  max_capacity: number;
  current_count: number;
  shelf: string;
  column_position: string;
  side: string;
  qr_code: string | null;
  is_active: boolean;
  created_at: string;
}

const BoxesPage = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingBox, setEditingBox] = useState<ArchiveBox | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    maxCapacity: '50',
    shelf: '',
    columnPosition: '',
    side: 'left' as 'left' | 'right',
  });

  useEffect(() => {
    fetchBoxes();
  }, []);

  const fetchBoxes = async () => {
    try {
      const { data, error } = await supabase
        .from('archive_boxes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setBoxes(data || []);
    } catch (error) {
      console.error('Error fetching boxes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (box?: ArchiveBox) => {
    if (box) {
      setEditingBox(box);
      setFormData({
        name: box.name,
        maxCapacity: box.max_capacity.toString(),
        shelf: box.shelf,
        columnPosition: box.column_position,
        side: box.side as 'left' | 'right',
      });
    } else {
      setEditingBox(null);
      setFormData({
        name: '',
        maxCapacity: '50',
        shelf: '',
        columnPosition: '',
        side: 'left',
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Box name is required', variant: 'destructive' });
      return;
    }
    if (!formData.shelf.trim()) {
      toast({ title: 'Error', description: 'Shelf is required', variant: 'destructive' });
      return;
    }
    if (!formData.columnPosition.trim()) {
      toast({ title: 'Error', description: 'Column position is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const boxData = {
        name: formData.name.trim(),
        max_capacity: parseInt(formData.maxCapacity) || 50,
        shelf: formData.shelf.trim(),
        column_position: formData.columnPosition.trim(),
        side: formData.side,
      };

      if (editingBox) {
        const { error } = await supabase
          .from('archive_boxes')
          .update(boxData)
          .eq('id', editingBox.id);

        if (error) throw error;
        toast({ title: 'Box updated', description: 'Archive box has been updated.' });
      } else {
        const { error } = await supabase
          .from('archive_boxes')
          .insert(boxData);

        if (error) throw error;
        toast({ title: 'Box created', description: 'New archive box has been created.' });
      }

      setShowDialog(false);
      fetchBoxes();
    } catch (error: any) {
      console.error('Error saving box:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save box',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (box: ArchiveBox) => {
    if (box.current_count > 0) {
      toast({
        title: 'Cannot delete',
        description: 'This box contains archives. Remove archives first.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${box.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('archive_boxes')
        .update({ is_active: false })
        .eq('id', box.id);

      if (error) throw error;
      toast({ title: 'Box deleted', description: 'Archive box has been deleted.' });
      fetchBoxes();
    } catch (error: any) {
      console.error('Error deleting box:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete box',
        variant: 'destructive',
      });
    }
  };

  const filteredBoxes = boxes.filter(box =>
    box.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    box.shelf.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusClass = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 100) return 'status-badge-danger';
    if (percentage >= 80) return 'status-badge-warning';
    return 'status-badge-success';
  };

  const getStatusLabel = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 100) return 'Full';
    if (percentage >= 80) return 'Almost Full';
    return 'Available';
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Archive Boxes</h1>
            <p className="text-muted-foreground">
              Manage archive storage boxes and their locations
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              New Box
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="card-stats">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search boxes by name or shelf..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Boxes Grid */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading boxes...</div>
        ) : filteredBoxes.length === 0 ? (
          <div className="card-stats text-center py-12">
            <Box className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No boxes found</p>
            {isAdmin && !searchQuery && (
              <Button onClick={() => handleOpenDialog()} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Create First Box
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBoxes.map((box) => (
              <div key={box.id} className="card-stats">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Box className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{box.name}</h3>
                      <span className={`status-badge ${getStatusClass(box.current_count, box.max_capacity)}`}>
                        {getStatusLabel(box.current_count, box.max_capacity)}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(box)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(box)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <CapacityIndicator
                    current={box.current_count}
                    max={box.max_capacity}
                  />

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{box.shelf}, {box.column_position} {box.side}</span>
                  </div>

                  {box.qr_code && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <QrCode className="w-4 h-4" />
                      <span>QR Code available</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingBox ? 'Edit Box' : 'Create New Box'}
            </DialogTitle>
            <DialogDescription>
              {editingBox 
                ? 'Update the archive box details below.'
                : 'Fill in the details to create a new archive box.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="boxName">Box Name *</Label>
              <Input
                id="boxName"
                placeholder="e.g., Box A-001"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Maximum Capacity</Label>
              <Input
                id="maxCapacity"
                type="number"
                min="1"
                placeholder="50"
                value={formData.maxCapacity}
                onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf">Shelf *</Label>
                <Input
                  id="shelf"
                  placeholder="e.g., Shelf A"
                  value={formData.shelf}
                  onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="column">Column *</Label>
                <Input
                  id="column"
                  placeholder="e.g., Column 2"
                  value={formData.columnPosition}
                  onChange={(e) => setFormData({ ...formData, columnPosition: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Side *</Label>
              <Select
                value={formData.side}
                onValueChange={(value: 'left' | 'right') => 
                  setFormData({ ...formData, side: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
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
              {editingBox ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default BoxesPage;
