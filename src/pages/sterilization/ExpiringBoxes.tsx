import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle, 
  Clock, 
  Box,
  Loader2,
  RefreshCw,
  Calendar,
  CheckCircle2,
  XCircle,
  Timer
} from 'lucide-react';
import { format, differenceInDays, differenceInHours, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface ExpiringBox {
  id: string;
  name: string;
  box_code: string;
  status: string;
  last_sterilized_at: string | null;
  next_sterilization_due: string | null;
  days_until_expiry: number;
  hours_until_expiry: number;
  is_expired: boolean;
  service_name?: string;
}

// Configuration: durée de validité de la stérilisation en jours
const STERILIZATION_VALIDITY_DAYS = 30;

const ExpiringBoxes = () => {
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<ExpiringBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'expired'>('all');

  useEffect(() => {
    fetchExpiringBoxes();
  }, []);

  const fetchExpiringBoxes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('instrument_boxes')
        .select(`
          id, name, box_code, status, last_sterilized_at, next_sterilization_due,
          service:services!instrument_boxes_service_id_fkey(name)
        `)
        .eq('is_active', true)
        .eq('status', 'sterile')
        .not('last_sterilized_at', 'is', null)
        .order('last_sterilized_at', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const processedBoxes: ExpiringBox[] = (data || []).map(box => {
        const lastSterilized = new Date(box.last_sterilized_at!);
        const expiryDate = box.next_sterilization_due 
          ? new Date(box.next_sterilization_due)
          : addDays(lastSterilized, STERILIZATION_VALIDITY_DAYS);

        const daysUntilExpiry = differenceInDays(expiryDate, now);
        const hoursUntilExpiry = differenceInHours(expiryDate, now);

        return {
          id: box.id,
          name: box.name,
          box_code: box.box_code,
          status: box.status,
          last_sterilized_at: box.last_sterilized_at,
          next_sterilization_due: box.next_sterilization_due,
          days_until_expiry: daysUntilExpiry,
          hours_until_expiry: hoursUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          service_name: (box.service as any)?.name,
        };
      });

      // Sort by expiry (most critical first)
      processedBoxes.sort((a, b) => a.hours_until_expiry - b.hours_until_expiry);

      setBoxes(processedBoxes);
    } catch (error) {
      console.error('Error fetching expiring boxes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkForResterilization = async (box: ExpiringBox) => {
    try {
      const { error } = await supabase
        .from('instrument_boxes')
        .update({ 
          status: 'dirty',
          current_step: 'reception',
        })
        .eq('id', box.id);

      if (error) throw error;

      toast({ 
        title: 'Boîte marquée', 
        description: `${box.name} envoyée en re-stérilisation` 
      });
      fetchExpiringBoxes();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const getExpiryBadge = (box: ExpiringBox) => {
    if (box.is_expired) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Périmée</Badge>;
    }
    if (box.days_until_expiry <= 3) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Critique</Badge>;
    }
    if (box.days_until_expiry <= 7) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 gap-1"><Clock className="w-3 h-3" /> Attention</Badge>;
    }
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1"><CheckCircle2 className="w-3 h-3" /> OK</Badge>;
  };

  const getProgressColor = (days: number) => {
    if (days < 0) return 'bg-destructive';
    if (days <= 3) return 'bg-destructive';
    if (days <= 7) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const filteredBoxes = boxes.filter(box => {
    switch (filter) {
      case 'expired': return box.is_expired;
      case 'critical': return !box.is_expired && box.days_until_expiry <= 3;
      case 'warning': return !box.is_expired && box.days_until_expiry > 3 && box.days_until_expiry <= 7;
      default: return true;
    }
  });

  const expiredCount = boxes.filter(b => b.is_expired).length;
  const criticalCount = boxes.filter(b => !b.is_expired && b.days_until_expiry <= 3).length;
  const warningCount = boxes.filter(b => !b.is_expired && b.days_until_expiry > 3 && b.days_until_expiry <= 7).length;
  const okCount = boxes.filter(b => !b.is_expired && b.days_until_expiry > 7).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
              Alertes Péremption
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi des dates de validité de stérilisation ({STERILIZATION_VALIDITY_DAYS} jours)
            </p>
          </div>
          <Button variant="outline" onClick={fetchExpiringBoxes} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={`cursor-pointer transition-all ${filter === 'expired' ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => setFilter(filter === 'expired' ? 'all' : 'expired')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{expiredCount}</p>
                  <p className="text-xs text-muted-foreground">Périmées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${filter === 'critical' ? 'ring-2 ring-destructive' : ''}`}
            onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground">Critiques (&lt;3j)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${filter === 'warning' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
                  <p className="text-xs text-muted-foreground">Attention (3-7j)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setFilter('all')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{okCount}</p>
                  <p className="text-xs text-muted-foreground">OK (&gt;7j)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Boxes List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Boîtes stériles {filter !== 'all' && `(${filter})`}
            </CardTitle>
            <CardDescription>
              {filteredBoxes.length} boîte(s) affichée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : filteredBoxes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune boîte stérile à afficher</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBoxes.map(box => (
                  <div 
                    key={box.id} 
                    className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border gap-4 ${
                      box.is_expired 
                        ? 'bg-destructive/5 border-destructive/30' 
                        : box.days_until_expiry <= 3 
                          ? 'bg-destructive/5 border-destructive/20'
                          : box.days_until_expiry <= 7
                            ? 'bg-amber-500/5 border-amber-500/20'
                            : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Box className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{box.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{box.box_code}</span>
                          {getExpiryBadge(box)}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {box.service_name && <span>Service: {box.service_name}</span>}
                          {box.last_sterilized_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Stérilisé le {format(new Date(box.last_sterilized_at), 'dd/MM/yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Timer className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs">
                              {box.is_expired 
                                ? `Périmée depuis ${Math.abs(box.days_until_expiry)} jour(s)`
                                : `${box.days_until_expiry} jour(s) restant(s)`
                              }
                            </span>
                          </div>
                          <Progress 
                            value={box.is_expired ? 100 : Math.max(0, ((STERILIZATION_VALIDITY_DAYS - box.days_until_expiry) / STERILIZATION_VALIDITY_DAYS) * 100)}
                            className={`h-2 ${getProgressColor(box.days_until_expiry)}`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(box.is_expired || box.days_until_expiry <= 3) && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive/10"
                          onClick={() => handleMarkForResterilization(box)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Re-stériliser
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/sterilization/history/${box.id}`}>
                          Historique
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ExpiringBoxes;
