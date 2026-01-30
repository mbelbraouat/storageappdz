import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowRight, History, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Movement {
  id: string;
  action: string;
  from_location: string | null;
  to_location: string | null;
  notes: string | null;
  created_at: string;
  performer: { full_name: string } | null;
}

interface BoxMovementHistoryProps {
  boxId: string;
}

const BoxMovementHistory = ({ boxId }: BoxMovementHistoryProps) => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMovements();
  }, [boxId]);

  const fetchMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('box_movements')
        .select('id, action, from_location, to_location, notes, created_at, performed_by')
        .eq('box_id', boxId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Fetch performer names
      if (data && data.length > 0) {
        const performerIds = [...new Set(data.map(m => m.performed_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', performerIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        const movementsWithPerformers = data.map(m => ({
          ...m,
          performer: { full_name: profileMap.get(m.performed_by) || 'Unknown' }
        }));
        setMovements(movementsWithPerformers);
      } else {
        setMovements([]);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Création';
      case 'moved': return 'Déplacement';
      case 'sealed': return 'Scellé';
      case 'opened': return 'Ouvert';
      case 'status_changed': return 'Statut modifié';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'text-success';
      case 'moved': return 'text-info';
      case 'sealed': return 'text-warning';
      case 'opened': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground text-sm">Chargement...</div>;
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucun historique de mouvement</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3 pr-4">
        {movements.map((movement) => (
          <div key={movement.id} className="p-3 rounded-lg bg-accent/30 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className={`font-medium text-sm ${getActionColor(movement.action)}`}>
                {getActionLabel(movement.action)}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(movement.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
              </span>
            </div>
            
            {movement.from_location && movement.to_location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <span>{movement.from_location}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{movement.to_location}</span>
              </div>
            )}
            
            {movement.notes && (
              <p className="text-sm text-muted-foreground mb-2">{movement.notes}</p>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>{movement.performer?.full_name}</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default BoxMovementHistory;
