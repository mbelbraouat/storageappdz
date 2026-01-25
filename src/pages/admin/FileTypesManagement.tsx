import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  FolderOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface FileType {
  id: string;
  name: string;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
}

const FileTypesManagement = () => {
  const { toast } = useToast();
  const [fileTypes, setFileTypes] = useState<FileType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingFileType, setEditingFileType] = useState<FileType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    isRequired: false,
  });

  useEffect(() => {
    fetchFileTypes();
  }, []);

  const fetchFileTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('file_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setFileTypes(data || []);
    } catch (error) {
      console.error('Error fetching file types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (ft?: FileType) => {
    if (ft) {
      setEditingFileType(ft);
      setFormData({
        name: ft.name,
        isRequired: ft.is_required,
      });
    } else {
      setEditingFileType(null);
      setFormData({ name: '', isRequired: false });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'File type name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const ftData = {
        name: formData.name.trim(),
        is_required: formData.isRequired,
      };

      if (editingFileType) {
        const { error } = await supabase
          .from('file_types')
          .update(ftData)
          .eq('id', editingFileType.id);

        if (error) throw error;
        toast({ title: 'File type updated', description: 'File type has been updated.' });
      } else {
        const { error } = await supabase
          .from('file_types')
          .insert(ftData);

        if (error) throw error;
        toast({ title: 'File type added', description: 'New file type has been added.' });
      }

      setShowDialog(false);
      fetchFileTypes();
    } catch (error: any) {
      console.error('Error saving file type:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save file type',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (ft: FileType) => {
    if (!confirm(`Are you sure you want to delete "${ft.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('file_types')
        .update({ is_active: false })
        .eq('id', ft.id);

      if (error) throw error;
      toast({ title: 'File type deleted', description: 'File type has been removed.' });
      fetchFileTypes();
    } catch (error: any) {
      console.error('Error deleting file type:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete file type',
        variant: 'destructive',
      });
    }
  };

  const filteredFileTypes = fileTypes.filter(ft =>
    ft.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FolderOpen className="w-7 h-7 text-primary" />
              File Types Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure document types for scanning during archiving
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Add File Type
          </Button>
        </div>

        {/* Search */}
        <div className="card-stats">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search file types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* File Types List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading file types...</div>
        ) : filteredFileTypes.length === 0 ? (
          <div className="card-stats text-center py-12">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No file types found</p>
            {!searchQuery && (
              <Button onClick={() => handleOpenDialog()} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Add First File Type
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFileTypes.map((ft) => (
              <div key={ft.id} className="card-stats">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{ft.name}</h3>
                      {ft.is_required ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Required
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground mt-1">Optional</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(ft)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ft)}
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
              {editingFileType ? 'Edit File Type' : 'Add New File Type'}
            </DialogTitle>
            <DialogDescription>
              {editingFileType 
                ? 'Update the file type settings below.'
                : 'Define a new document type for archiving.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">File Type Name *</Label>
              <Input
                id="name"
                placeholder="e.g., X-Ray Report, Lab Results"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/30">
              <div>
                <Label htmlFor="required" className="font-medium">Required Document</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  If enabled, this document must be included in every archive
                </p>
              </div>
              <Switch
                id="required"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
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
              {editingFileType ? 'Update' : 'Add File Type'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default FileTypesManagement;
