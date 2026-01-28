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
  Stethoscope, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Loader2,
  Home
} from 'lucide-react';

interface Doctor {
  id: string;
  full_name: string;
  specialty: string | null;
  is_active: boolean;
  local_archive: boolean;
  created_at: string;
}

const DoctorsManagement = () => {
  const { toast } = useToast();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    specialty: '',
    localArchive: false,
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (doctor?: Doctor) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        fullName: doctor.full_name,
        specialty: doctor.specialty || '',
        localArchive: doctor.local_archive || false,
      });
    } else {
      setEditingDoctor(null);
      setFormData({ fullName: '', specialty: '', localArchive: false });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.fullName.trim()) {
      toast({ title: 'Error', description: 'Doctor name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const doctorData = {
        full_name: formData.fullName.trim(),
        specialty: formData.specialty.trim() || null,
        local_archive: formData.localArchive,
      };

      if (editingDoctor) {
        const { error } = await supabase
          .from('doctors')
          .update(doctorData)
          .eq('id', editingDoctor.id);

        if (error) throw error;
        toast({ title: 'Doctor updated', description: 'Doctor has been updated.' });
      } else {
        const { error } = await supabase
          .from('doctors')
          .insert(doctorData);

        if (error) throw error;
        toast({ title: 'Doctor added', description: 'New doctor has been added.' });
      }

      setShowDialog(false);
      fetchDoctors();
    } catch (error: any) {
      console.error('Error saving doctor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save doctor',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doctor: Doctor) => {
    if (!confirm(`Are you sure you want to delete Dr. ${doctor.full_name}?`)) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_active: false })
        .eq('id', doctor.id);

      if (error) throw error;
      toast({ title: 'Doctor deleted', description: 'Doctor has been removed.' });
      fetchDoctors();
    } catch (error: any) {
      console.error('Error deleting doctor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete doctor',
        variant: 'destructive',
      });
    }
  };

  const filteredDoctors = doctors.filter(doctor =>
    doctor.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doctor.specialty && doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Stethoscope className="w-7 h-7 text-primary" />
              Doctors Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Add and manage doctors for archive records
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Doctor
          </Button>
        </div>

        {/* Search */}
        <div className="card-stats">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search doctors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Doctors List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading doctors...</div>
        ) : filteredDoctors.length === 0 ? (
          <div className="card-stats text-center py-12">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No doctors found</p>
            {!searchQuery && (
              <Button onClick={() => handleOpenDialog()} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Add First Doctor
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map((doctor) => (
              <div key={doctor.id} className="card-stats">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        Dr. {doctor.full_name}
                        {doctor.local_archive && (
                          <span title="Local Archive">
                            <Home className="w-3 h-3 text-warning" />
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {doctor.specialty || 'General'}
                        {doctor.local_archive && ' • Local Archive'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(doctor)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doctor)}
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
              {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
            </DialogTitle>
            <DialogDescription>
              {editingDoctor 
                ? 'Update the doctor information below.'
                : 'Enter the doctor details to add them to the system.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Enter doctor's full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                placeholder="e.g., Cardiology, Surgery"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
              <div>
                <Label htmlFor="localArchive" className="cursor-pointer">Local Archive</Label>
                <p className="text-xs text-muted-foreground">
                  Doctor archives locally (exempt from sequential numbering)
                </p>
              </div>
              <Switch
                id="localArchive"
                checked={formData.localArchive}
                onCheckedChange={(checked) => setFormData({ ...formData, localArchive: checked })}
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
              {editingDoctor ? 'Update' : 'Add Doctor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default DoctorsManagement;
