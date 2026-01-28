import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import CapacityIndicator from '@/components/ui/CapacityIndicator';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Archive, 
  Box, 
  MapPin,
  Calendar,
  User,
  Stethoscope,
  FileText,
  Eye,
  Edit,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface ArchiveData {
  id: string;
  patient_full_name: string;
  admission_id: string;
  patient_id: string;
  notes: string | null;
  year: number;
  archive_number: number | null;
  is_archived: boolean;
  created_at: string;
  created_by: string;
  doctor_id: string;
  operation_acte_id: string;
  box_id: string;
  doctor: { id: string; full_name: string } | null;
  operation: { id: string; name: string } | null;
  box: { id: string; name: string; shelf: string; column_position: string; side: string; current_count: number; max_capacity: number } | null;
}

interface ArchiveFile {
  id: string;
  file_type_id: string;
  file_name: string | null;
  file_url: string | null;
  is_attached: boolean;
  file_type: { name: string } | null;
}

interface ArchiveBox {
  id: string;
  name: string;
  current_count: number;
  max_capacity: number;
  shelf: string;
  column_position: string;
  side: string;
}

const ArchiveDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);
  const [creator, setCreator] = useState<string>('Unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    patientFullName: '',
    admissionId: '',
    patientId: '',
    boxId: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      fetchArchiveData();
    }
  }, [id]);

  const fetchArchiveData = async () => {
    try {
      // Fetch archive with related data
      const { data: archiveData, error: archiveError } = await supabase
        .from('archives')
        .select(`
          id,
          patient_full_name,
          admission_id,
          patient_id,
          notes,
          year,
          archive_number,
          is_archived,
          created_at,
          created_by,
          doctor_id,
          operation_acte_id,
          box_id,
          doctor:doctors(id, full_name),
          operation:operation_actes(id, name),
          box:archive_boxes(id, name, shelf, column_position, side, current_count, max_capacity)
        `)
        .eq('id', id)
        .maybeSingle();

      if (archiveError) throw archiveError;
      if (!archiveData) {
        toast({ title: 'Error', description: 'Archive not found', variant: 'destructive' });
        navigate('/archives');
        return;
      }

      setArchive(archiveData as any);
      setFormData({
        patientFullName: archiveData.patient_full_name,
        admissionId: archiveData.admission_id,
        patientId: archiveData.patient_id,
        boxId: archiveData.box_id,
        notes: archiveData.notes || '',
      });

      // Fetch creator profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', archiveData.created_by)
        .maybeSingle();
      
      if (profile) setCreator(profile.full_name);

      // Fetch archive files
      const { data: filesData } = await supabase
        .from('archive_files')
        .select(`
          id,
          file_type_id,
          file_name,
          file_url,
          is_attached,
          file_type:file_types(name)
        `)
        .eq('archive_id', id);

      setFiles(filesData as any || []);

      // Fetch available boxes for editing
      const { data: boxesData } = await supabase
        .from('archive_boxes')
        .select('id, name, current_count, max_capacity, shelf, column_position, side')
        .eq('is_active', true)
        .order('name');

      setBoxes(boxesData || []);

    } catch (error) {
      console.error('Error fetching archive:', error);
      toast({ title: 'Error', description: 'Failed to load archive', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!archive || !user) return;

    setIsSaving(true);

    try {
      // Check if moving to a different box
      const newBox = boxes.find(b => b.id === formData.boxId);
      if (newBox && formData.boxId !== archive.box_id) {
        if (newBox.current_count >= newBox.max_capacity) {
          toast({ title: 'Error', description: 'Selected box is full', variant: 'destructive' });
          setIsSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('archives')
        .update({
          patient_full_name: formData.patientFullName.trim(),
          admission_id: formData.admissionId.trim(),
          patient_id: formData.patientId.trim(),
          box_id: formData.boxId,
          notes: formData.notes.trim() || null,
        })
        .eq('id', archive.id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'archive',
        entity_id: archive.id,
        details: { 
          patient_name: formData.patientFullName,
          moved_box: formData.boxId !== archive.box_id 
        },
      });

      toast({ title: 'Success', description: 'Archive updated successfully' });
      setIsEditing(false);
      fetchArchiveData();
    } catch (error: any) {
      console.error('Error updating archive:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = archive && (archive.created_by === user?.id || isAdmin);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!archive) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <Archive className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Archive Not Found</h2>
          <Button onClick={() => navigate('/archives')}>Back to Archives</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <Archive className="w-7 h-7 text-primary" />
                {archive.patient_full_name}
              </h1>
              <p className="text-muted-foreground">
                {archive.archive_number ? `Archive #${archive.archive_number}` : 'Local Archive'} • {archive.year}
              </p>
            </div>
          </div>
          {canEdit && !isEditing && (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="w-4 h-4" />
              Edit Archive
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Information */}
            <div className="card-stats">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Patient Information
              </h2>
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Patient Full Name</Label>
                    <Input
                      value={formData.patientFullName}
                      onChange={(e) => setFormData({ ...formData, patientFullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Admission ID</Label>
                    <Input
                      value={formData.admissionId}
                      onChange={(e) => setFormData({ ...formData, admissionId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Patient ID</Label>
                    <Input
                      value={formData.patientId}
                      onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{archive.patient_full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admission ID</p>
                    <p className="font-medium">{archive.admission_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Patient ID</p>
                    <p className="font-medium">{archive.patient_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Year</p>
                    <p className="font-medium">{archive.year}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Medical Details */}
            <div className="card-stats">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                Medical Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Doctor</p>
                  <p className="font-medium">Dr. {archive.doctor?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Operation</p>
                  <p className="font-medium">{archive.operation?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label className="text-muted-foreground">Notes</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{archive.notes || 'No notes'}</p>
                )}
              </div>
            </div>

            {/* Files */}
            <div className="card-stats">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Attached Files
              </h2>
              {files.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No files attached</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div 
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/30"
                    >
                      <div className="flex items-center gap-3">
                        {file.is_attached ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{file.file_type?.name || 'Unknown Type'}</p>
                          <p className="text-sm text-muted-foreground">
                            {file.file_name || 'Not uploaded'}
                          </p>
                        </div>
                      </div>
                      {file.file_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFileUrl(file.file_url)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Box Location */}
            <div className="card-stats">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" />
                Storage Location
              </h2>
              {isEditing ? (
                <div className="space-y-3">
                  <Label>Move to Box</Label>
                  <Select
                    value={formData.boxId}
                    onValueChange={(value) => setFormData({ ...formData, boxId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select box" />
                    </SelectTrigger>
                    <SelectContent>
                      {boxes.map((box) => (
                        <SelectItem 
                          key={box.id} 
                          value={box.id}
                          disabled={box.id !== formData.boxId && box.current_count >= box.max_capacity}
                        >
                          {box.name} ({box.current_count}/{box.max_capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : archive.box ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{archive.box.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {archive.box.shelf}, {archive.box.column_position} {archive.box.side}
                    </span>
                  </div>
                  <CapacityIndicator 
                    current={archive.box.current_count} 
                    max={archive.box.max_capacity}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">No box assigned</p>
              )}
            </div>

            {/* Meta Information */}
            <div className="card-stats">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">
                    {format(new Date(archive.created_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created by</p>
                  <p className="text-sm font-medium">{creator}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`status-badge ${archive.is_archived ? 'status-badge-success' : 'status-badge-warning'}`}>
                    {archive.is_archived ? 'Archived' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File Viewer Dialog */}
      <Dialog open={!!selectedFileUrl} onOpenChange={() => setSelectedFileUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>File Viewer</DialogTitle>
            <DialogDescription>Preview attached document</DialogDescription>
          </DialogHeader>
          {selectedFileUrl && (
            <iframe 
              src={selectedFileUrl} 
              className="w-full h-full rounded-lg border"
              title="File preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ArchiveDetail;
