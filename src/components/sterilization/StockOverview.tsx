import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Box, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Droplets, 
  Zap, 
  Wrench,
  Package
} from 'lucide-react';
import { type InstrumentBox, type SterilizationStatus, STATUS_LABELS } from './BoxCard';

interface StockOverviewProps {
  boxes: InstrumentBox[];
}

const StockOverview = ({ boxes }: StockOverviewProps) => {
  const stats = useMemo(() => {
    const byStatus: Record<SterilizationStatus, number> = {
      dirty: 0,
      cleaning: 0,
      ready_for_sterilization: 0,
      sterilizing: 0,
      sterile: 0,
      in_use: 0,
    };

    boxes.forEach((box) => {
      byStatus[box.status]++;
    });

    return {
      total: boxes.length,
      byStatus,
      availablePercent: boxes.length > 0 ? (byStatus.sterile / boxes.length) * 100 : 0,
    };
  }, [boxes]);

  const statusCards = [
    { key: 'sterile' as SterilizationStatus, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-500/10' },
    { key: 'in_use' as SterilizationStatus, icon: Wrench, color: 'text-slate-600 bg-slate-500/10' },
    { key: 'dirty' as SterilizationStatus, icon: AlertCircle, color: 'text-destructive bg-destructive/10' },
    { key: 'cleaning' as SterilizationStatus, icon: Droplets, color: 'text-blue-600 bg-blue-500/10' },
    { key: 'ready_for_sterilization' as SterilizationStatus, icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
    { key: 'sterilizing' as SterilizationStatus, icon: Zap, color: 'text-primary bg-primary/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Main Overview Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5 text-primary" />
            Stock des boîtes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Boîtes totales</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">{stats.byStatus.sterile}</p>
              <p className="text-sm text-muted-foreground">Disponibles (stériles)</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taux de disponibilité</span>
              <span className="font-medium">{stats.availablePercent.toFixed(0)}%</span>
            </div>
            <Progress value={stats.availablePercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusCards.map(({ key, icon: Icon, color }) => (
          <Card key={key} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-2`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{stats.byStatus[key]}</p>
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[key].label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Alerts */}
      {stats.byStatus.dirty > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                {stats.byStatus.dirty} boîte(s) en attente de traitement
              </p>
              <p className="text-sm text-muted-foreground">
                Scannez-les pour démarrer le processus de stérilisation
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.byStatus.sterilizing > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="font-medium text-primary">
                {stats.byStatus.sterilizing} boîte(s) en cours de stérilisation
              </p>
              <p className="text-sm text-muted-foreground">
                Cycle en cours, veuillez patienter
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StockOverview;
