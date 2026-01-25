import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Archive, 
  Search, 
  Filter, 
  Eye, 
  Edit,
  FileText,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Box,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';

interface ArchiveItem {
  id: string;
  patient_full_name: string;
  admission_id: string;
  patient_id: string;
  notes: string | null;
  year: number;
  is_archived: boolean;
  created_at: string;
  doctor: { full_name: string } | null;
  operation: { name: string } | null;
  box: { name: string; shelf: string; column_position: string; side: string } | null;
  creator: { full_name: string } | null;
  files: { id: string; is_attached: boolean }[];
}

const ArchivesList = () => {
  const navigate = useNavigate();
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [boxFilter, setBoxFilter] = useState<string>('all');
  const [boxes, setBoxes] = useState<{ id: string; name: string }[]>([]);
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    fetchArchives();
    fetchFilters();
  }, []);

  const fetchArchives = async () => {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select(`
          id,
          patient_full_name,
          admission_id,
          patient_id,
          notes,
          year,
          is_archived,
          created_at,
          doctor:doctors(full_name),
          operation:operation_actes(name),
          box:archive_boxes(name, shelf, column_position, side),
          creator:profiles!archives_created_by_fkey(full_name),
          files:archive_files(id, is_attached)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArchives(data as any || []);
    } catch (error) {
      console.error('Error fetching archives:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilters = async () => {
    const { data: boxesData } = await supabase
      .from('archive_boxes')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    setBoxes(boxesData || []);

    // Get unique years
    const { data: yearsData } = await supabase
      .from('archives')
      .select('year')
      .order('year', { ascending: false });

    const uniqueYears = [...new Set(yearsData?.map(a => a.year) || [])];
    setYears(uniqueYears);
  };

  const filteredArchives = archives.filter(archive => {
    const matchesSearch = 
      archive.patient_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      archive.admission_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      archive.patient_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesYear = yearFilter === 'all' || archive.year.toString() === yearFilter;
    const matchesBox = boxFilter === 'all' || archive.box?.name === boxFilter;

    return matchesSearch && matchesYear && matchesBox;
  });

  const getFileStatus = (files: { is_attached: boolean }[]) => {
    if (files.length === 0) return { attached: 0, total: 0 };
    const attached = files.filter(f => f.is_attached).length;
    return { attached, total: files.length };
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Archives</h1>
            <p className="text-muted-foreground">
              View and manage all patient archives
            </p>
          </div>
          <Button onClick={() => navigate('/archives/new')} className="gap-2">
            <Archive className="w-4 h-4" />
            New Archive
          </Button>
        </div>

        {/* Filters */}
        <div className="card-stats">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, admission ID, or patient ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={boxFilter} onValueChange={setBoxFilter}>
                <SelectTrigger className="w-[160px]">
                  <Box className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Box" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Boxes</SelectItem>
                  {boxes.map(box => (
                    <SelectItem key={box.id} value={box.name}>{box.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Archives Table */}
        <div className="card-stats overflow-hidden p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading archives...
            </div>
          ) : filteredArchives.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No archives found</p>
              {searchQuery && (
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-medical">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>IDs</th>
                    <th>Doctor / Operation</th>
                    <th>Box / Location</th>
                    <th>Files</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchives.map((archive) => {
                    const fileStatus = getFileStatus(archive.files);
                    return (
                      <tr key={archive.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Archive className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{archive.patient_full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Year: {archive.year}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="text-sm">Adm: {archive.admission_id}</p>
                          <p className="text-sm text-muted-foreground">Pat: {archive.patient_id}</p>
                        </td>
                        <td>
                          <p className="text-sm">{archive.doctor?.full_name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">
                            {archive.operation?.name || 'N/A'}
                          </p>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Box className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{archive.box?.name || 'N/A'}</span>
                          </div>
                          {archive.box && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {archive.box.shelf}, {archive.box.column_position} {archive.box.side}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {fileStatus.total > 0 ? (
                              <>
                                {fileStatus.attached === fileStatus.total ? (
                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                ) : (
                                  <FileText className="w-4 h-4 text-warning" />
                                )}
                                <span className="text-sm">
                                  {fileStatus.attached}/{fileStatus.total}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">No files</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(archive.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {archive.creator?.full_name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/archives/${archive.id}`)}
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/archives/${archive.id}/edit`)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!isLoading && filteredArchives.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredArchives.length} of {archives.length} archives
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default ArchivesList;
