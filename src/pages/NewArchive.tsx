import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Upload, X, FileText } from 'lucide-react';
import CapacityIndicator from '@/components/ui/CapacityIndicator';

interface Doctor {
  id: string;
  full_name: string;
  specialty: string | null;
}

interface OperationActe {
  id: string;
  name: string;
}

interface FileType {
  id: string;
  name: string;
  is_required: boolean;
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

const NewArchive = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [operations, setOperations] = useState<OperationActe[]>([]);
  const [fileTypes, setFileTypes] = useState<FileType[]>([]);
  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);

  const [formData, setFormData] = useState({
    patientFullName: '',
    admissionId: '',
    patientId: '',
    doctorId: '',
    operationActeId: '',
    boxId: '',
    notes: '',
  });

  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({});

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const [doctorsRes, operationsRes, fileTypesRes, boxesRes] = await Promise.all([
        supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
        supabase.from('operation_actes').select('*').eq('is_active', true).order('name'),
        supabase.from('file_types').select('*').eq('is_active', true).order('name'),
        supabase.from('archive_boxes').select('*').eq('is_active', true).order('name'),
      ]);

      setDoctors(doctorsRes.data || []);
      setOperations(operationsRes.data || []);
      setFileTypes(fileTypesRes.data || []);
      setBoxes(boxesRes.data || []);

      // Initialize selected files with required ones
      const initialSelection: Record<string, boolean> = {};
      fileTypesRes.data?.forEach(ft => {
        initialSelection[ft.id] = ft.is_required;
      });
      setSelectedFiles(initialSelection);
    } catch (error) {
      console.error('Error fetching form data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load form data. Please refresh the page.',
        variant: 'destructive',
      });
    }
  };

  const validateForm = () => {
    if (!formData.patientFullName.trim()) {
      toast({ title: 'Error', description: 'Patient name is required', variant: 'destructive' });
      return false;
    }
    if (!formData.admissionId.trim()) {
      toast({ title: 'Error', description: 'Admission ID is required', variant: 'destructive' });
      return false;
    }
    if (!formData.patientId.trim()) {
      toast({ title: 'Error', description: 'Patient ID is required', variant: 'destructive' });
      return false;
    }
    if (!formData.doctorId) {
      toast({ title: 'Error', description: 'Please select a doctor', variant: 'destructive' });
      return false;
    }
    if (!formData.operationActeId) {
      toast({ title: 'Error', description: 'Please select an operation', variant: 'destructive' });
      return false;
    }
    if (!formData.boxId) {
      toast({ title: 'Error', description: 'Please select an archive box', variant: 'destructive' });
      return false;
    }

    // Check required files
    const requiredFiles = fileTypes.filter(ft => ft.is_required);
    for (const ft of requiredFiles) {
      if (!selectedFiles[ft.id]) {
        toast({ 
          title: 'Error', 
          description: `"${ft.name}" is a required document`, 
          variant: 'destructive' 
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) return;

    setIsLoading(true);

    try {
      // Check box capacity
      const selectedBox = boxes.find(b => b.id === formData.boxId);
      if (selectedBox && selectedBox.current_count >= selectedBox.max_capacity) {
        toast({
          title: 'Box is full',
          description: 'Please select a different archive box.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Create archive
      const { data: archive, error: archiveError } = await supabase
        .from('archives')
        .insert({
          patient_full_name: formData.patientFullName.trim(),
          admission_id: formData.admissionId.trim(),
          patient_id: formData.patientId.trim(),
          doctor_id: formData.doctorId,
          operation_acte_id: formData.operationActeId,
          box_id: formData.boxId,
          created_by: user.id,
          notes: formData.notes.trim() || null,
        })
        .select()
        .single();

      if (archiveError) throw archiveError;

      // Create archive file entries
      const fileEntries = Object.entries(selectedFiles)
        .filter(([_, isSelected]) => isSelected)
        .map(([fileTypeId]) => ({
          archive_id: archive.id,
          file_type_id: fileTypeId,
          is_attached: !!uploadedFiles[fileTypeId],
          file_name: uploadedFiles[fileTypeId]?.name || null,
        }));

      if (fileEntries.length > 0) {
        const { error: filesError } = await supabase
          .from('archive_files')
          .insert(fileEntries);

        if (filesError) throw filesError;
      }

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: user.id,
        action: 'create',
        entity_type: 'archive',
        entity_id: archive.id,
        details: { patient_name: formData.patientFullName },
      });

      toast({
        title: 'Archive created!',
        description: 'The patient archive has been successfully created.',
      });

      navigate('/archives');
    } catch (error: any) {
      console.error('Error creating archive:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create archive. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBox = boxes.find(b => b.id === formData.boxId);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">New Archive</h1>
            <p className="text-muted-foreground">Create a new patient archive record</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Patient Information */}
          <div className="card-stats">
            <h2 className="text-lg font-semibold mb-6">Patient Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="patientFullName">Patient Full Name *</Label>
                <Input
                  id="patientFullName"
                  placeholder="Enter patient's full name"
                  value={formData.patientFullName}
                  onChange={(e) => setFormData({ ...formData, patientFullName: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissionId">Admission ID (BMRIS) *</Label>
                <Input
                  id="admissionId"
                  placeholder="Enter admission ID"
                  value={formData.admissionId}
                  onChange={(e) => setFormData({ ...formData, admissionId: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID (BMRIS) *</Label>
                <Input
                  id="patientId"
                  placeholder="Enter patient ID"
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* Medical Details */}
          <div className="card-stats">
            <h2 className="text-lg font-semibold mb-6">Medical Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Doctor *</Label>
                <Select
                  value={formData.doctorId}
                  onValueChange={(value) => setFormData({ ...formData, doctorId: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.full_name} {doctor.specialty && `(${doctor.specialty})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {doctors.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No doctors available. Ask admin to add doctors.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Operation Acte *</Label>
                <Select
                  value={formData.operationActeId}
                  onValueChange={(value) => setFormData({ ...formData, operationActeId: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select an operation" />
                  </SelectTrigger>
                  <SelectContent>
                    {operations.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {operations.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No operations available. Ask admin to add operations.
                  </p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Scanned Files */}
          <div className="card-stats">
            <h2 className="text-lg font-semibold mb-6">Scanned Documents</h2>
            {fileTypes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No file types configured. Ask admin to add file types.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fileTypes.map((fileType) => (
                  <div 
                    key={fileType.id}
                    className={`
                      flex items-center gap-4 p-4 rounded-lg border transition-colors
                      ${selectedFiles[fileType.id] 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-background'}
                    `}
                  >
                    <Checkbox
                      id={`file-${fileType.id}`}
                      checked={selectedFiles[fileType.id] || false}
                      onCheckedChange={(checked) => 
                        setSelectedFiles({ ...selectedFiles, [fileType.id]: !!checked })
                      }
                      disabled={fileType.is_required}
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor={`file-${fileType.id}`}
                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {fileType.name}
                        {fileType.is_required && (
                          <span className="text-xs text-destructive">*Required</span>
                        )}
                      </label>
                    </div>
                    {selectedFiles[fileType.id] && (
                      <div className="flex items-center gap-2">
                        {uploadedFiles[fileType.id] ? (
                          <div className="flex items-center gap-1 text-xs text-success">
                            <span className="truncate max-w-[100px]">
                              {uploadedFiles[fileType.id]?.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setUploadedFiles({ 
                                ...uploadedFiles, 
                                [fileType.id]: null 
                              })}
                              className="p-1 hover:bg-destructive/10 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setUploadedFiles({ ...uploadedFiles, [fileType.id]: file });
                                }
                              }}
                            />
                            <span className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Upload className="w-3 h-3" /> Upload
                            </span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Archive Location */}
          <div className="card-stats">
            <h2 className="text-lg font-semibold mb-6">Archive Location</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Archive Box *</Label>
                <Select
                  value={formData.boxId}
                  onValueChange={(value) => setFormData({ ...formData, boxId: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select an archive box" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxes
                      .filter(box => box.current_count < box.max_capacity)
                      .map((box) => (
                        <SelectItem key={box.id} value={box.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{box.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({box.current_count}/{box.max_capacity}) • {box.shelf}, {box.column_position} {box.side}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {boxes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No boxes available. Ask admin to create archive boxes.
                  </p>
                )}
              </div>

              {selectedBox && (
                <div className="p-4 rounded-lg bg-accent/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{selectedBox.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {selectedBox.shelf}, {selectedBox.column_position} {selectedBox.side}
                    </span>
                  </div>
                  <CapacityIndicator 
                    current={selectedBox.current_count} 
                    max={selectedBox.max_capacity} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Archive
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default NewArchive;
