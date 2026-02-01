import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Box, Edit, Trash2, QrCode, CheckCircle2, AlertCircle, Clock, Droplets, Zap, Wrench, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SterilizationStatus = 'dirty' | 'cleaning' | 'ready_for_sterilization' | 'sterilizing' | 'sterile' | 'in_use';
export type SterilizationStep = 'reception' | 'pre_disinfection' | 'cleaning' | 'conditioning' | 'sterilization' | 'control' | 'storage' | 'distribution';
export type SterilizationType = 'vapeur' | 'plasma' | 'oxyde_ethylene' | 'radiation';

export interface InstrumentBox {
  id: string;
  name: string;
  box_code: string;
  description: string | null;
  status: SterilizationStatus;
  current_step: SterilizationStep | null;
  sterilization_type: SterilizationType | null;
  last_sterilized_at: string | null;
  next_sterilization_due: string | null;
  is_active: boolean;
  created_at: string;
  service_id: string | null;
  assigned_service_id: string | null;
  assigned_bloc: string | null;
  service?: { name: string; code: string } | null;
  assigned_service?: { name: string; code: string } | null;
}

export const STATUS_LABELS: Record<SterilizationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  dirty: { label: 'Sale', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <AlertCircle className="w-3 h-3" /> },
  cleaning: { label: 'Nettoyage', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <Droplets className="w-3 h-3" /> },
  ready_for_sterilization: { label: 'Prêt', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: <Clock className="w-3 h-3" /> },
  sterilizing: { label: 'En stérilisation', color: 'bg-primary/10 text-primary border-primary/20', icon: <Zap className="w-3 h-3" /> },
  sterile: { label: 'Stérile', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  in_use: { label: 'En utilisation', color: 'bg-muted text-muted-foreground border-muted', icon: <Wrench className="w-3 h-3" /> },
};

export const STEP_LABELS: Record<SterilizationStep, { label: string; order: number }> = {
  reception: { label: 'Réception', order: 1 },
  pre_disinfection: { label: 'Pré-désinfection', order: 2 },
  cleaning: { label: 'Nettoyage', order: 3 },
  conditioning: { label: 'Conditionnement', order: 4 },
  sterilization: { label: 'Stérilisation', order: 5 },
  control: { label: 'Contrôle', order: 6 },
  storage: { label: 'Stockage', order: 7 },
  distribution: { label: 'Distribution', order: 8 },
};

export const STERILIZATION_TYPES: Record<SterilizationType, string> = {
  vapeur: 'Vapeur d\'eau',
  plasma: 'Plasma H2O2',
  oxyde_ethylene: 'Oxyde d\'éthylène',
  radiation: 'Rayonnement',
};

interface BoxCardProps {
  box: InstrumentBox;
  isAdmin: boolean;
  onEdit: (box: InstrumentBox) => void;
  onDelete: (box: InstrumentBox) => void;
  onStatusChange: (box: InstrumentBox, status: SterilizationStatus) => void;
  onShowQR: (box: InstrumentBox) => void;
  instrumentCount?: number;
}

const BoxCard = ({ box, isAdmin, onEdit, onDelete, onStatusChange, onShowQR, instrumentCount = 0 }: BoxCardProps) => {
  const statusInfo = STATUS_LABELS[box.status];
  const stepInfo = box.current_step ? STEP_LABELS[box.current_step] : null;

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Box className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{box.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{box.box_code}</p>
          </div>
        </div>
        <Badge variant="outline" className={`${statusInfo.color} gap-1`}>
          {statusInfo.icon}
          {statusInfo.label}
        </Badge>
      </div>

      {box.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{box.description}</p>
      )}

      <div className="space-y-2 mb-3">
        {stepInfo && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Étape:</span>
            <Badge variant="secondary" className="text-xs">{stepInfo.label}</Badge>
          </div>
        )}

        {box.sterilization_type && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium">{STERILIZATION_TYPES[box.sterilization_type]}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <Package className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">{instrumentCount} instrument(s)</span>
        </div>

        {box.assigned_service && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Affecté à:</span>
            <Badge variant="outline" className="text-xs">{box.assigned_service.name}</Badge>
            {box.assigned_bloc && <span className="text-muted-foreground">- {box.assigned_bloc}</span>}
          </div>
        )}

        {box.last_sterilized_at && (
          <p className="text-xs text-muted-foreground">
            Dernière stérilisation: {format(new Date(box.last_sterilized_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t gap-2">
        <Select
          value={box.status}
          onValueChange={(v: SterilizationStatus) => onStatusChange(box, v)}
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([status, info]) => (
              <SelectItem key={status} value={status} className="text-xs">
                <span className="flex items-center gap-2">
                  {info.icon} {info.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onShowQR(box)}>
            <QrCode className="w-4 h-4" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(box)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(box)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoxCard;
