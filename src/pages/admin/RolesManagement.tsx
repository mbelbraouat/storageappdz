import AppLayout from '@/components/layout/AppLayout';
import RolePermissionsEditor from '@/components/admin/RolePermissionsEditor';
import { Shield } from 'lucide-react';

const RolesManagement = () => {
  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary" />
            Gestion des Rôles
          </h1>
          <p className="text-muted-foreground mt-1">
            Configurez les permissions pour chaque rôle utilisateur
          </p>
        </div>

        <div className="card-stats">
          <RolePermissionsEditor />
        </div>
      </div>
    </AppLayout>
  );
};

export default RolesManagement;
