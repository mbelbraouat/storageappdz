import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, Save } from 'lucide-react';

interface Permission {
  id: string;
  role: string;
  permission_key: string;
  is_allowed: boolean;
}

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  manage_users: { label: 'Gérer les utilisateurs', description: 'Créer, modifier et supprimer des comptes utilisateur' },
  manage_roles: { label: 'Gérer les rôles', description: 'Modifier les permissions des rôles' },
  manage_doctors: { label: 'Gérer les docteurs', description: 'Ajouter et modifier la liste des docteurs' },
  manage_operations: { label: 'Gérer les opérations', description: 'Ajouter et modifier la liste des opérations' },
  manage_file_types: { label: 'Gérer les types de fichiers', description: 'Configurer les types de documents' },
  manage_boxes: { label: 'Gérer les boxes', description: 'Créer et modifier les boxes d\'archives' },
  manage_archives: { label: 'Gérer les archives', description: 'Créer et modifier les archives' },
  view_all_archives: { label: 'Voir toutes les archives', description: 'Accéder à l\'ensemble des archives' },
  export_data: { label: 'Exporter les données', description: 'Télécharger les exports CSV/Excel' },
  import_data: { label: 'Importer les données', description: 'Importer des données depuis des fichiers' },
  system_settings: { label: 'Paramètres système', description: 'Configurer les paramètres généraux' },
  manage_sterilization: { label: 'Gérer la stérilisation', description: 'Accéder au module de stérilisation' },
};

const RolePermissionsEditor = () => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('permission_key');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (permissionKey: string, role: string) => {
    setPermissions(prev => prev.map(p => {
      if (p.permission_key === permissionKey && p.role === role) {
        return { ...p, is_allowed: !p.is_allowed };
      }
      return p;
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rolePermissions = permissions.filter(p => p.role === selectedRole);
      
      for (const perm of rolePermissions) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ is_allowed: perm.is_allowed })
          .eq('id', perm.id);

        if (error) throw error;
      }

      toast({ 
        title: 'Permissions enregistrées', 
        description: `Les permissions du rôle "${selectedRole}" ont été mises à jour.` 
      });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder les permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getRolePermissions = (role: string) => {
    return permissions.filter(p => p.role === role);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Chargement des permissions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Éditeur de Permissions</h2>
            <p className="text-sm text-muted-foreground">
              Configurez les permissions pour chaque rôle
            </p>
          </div>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        )}
      </div>

      <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'user')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="admin">Administrateur</TabsTrigger>
          <TabsTrigger value="user">Utilisateur</TabsTrigger>
        </TabsList>

        {['admin', 'user'].map(role => (
          <TabsContent key={role} value={role} className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getRolePermissions(role).map(permission => {
                const info = PERMISSION_LABELS[permission.permission_key] || {
                  label: permission.permission_key,
                  description: ''
                };
                
                return (
                  <div
                    key={permission.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      permission.is_allowed 
                        ? 'bg-success/5 border-success/30' 
                        : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={permission.id}
                        checked={permission.is_allowed}
                        onCheckedChange={() => handleTogglePermission(permission.permission_key, role)}
                        disabled={role === 'admin'} // Admin permissions are locked
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={permission.id}
                          className={`font-medium cursor-pointer ${
                            role === 'admin' ? 'opacity-75' : ''
                          }`}
                        >
                          {info.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {role === 'admin' && (
              <p className="mt-4 text-sm text-muted-foreground italic">
                Les permissions administrateur ne peuvent pas être modifiées pour des raisons de sécurité.
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default RolePermissionsEditor;
