import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  HardDrive, 
  Mail,
  Save,
  Loader2,
  Lock,
  Hash
} from 'lucide-react';

interface LdapSettings {
  enabled: boolean;
  server: string;
  port: string;
  baseDn: string;
  bindDn: string;
}

interface NasSettings {
  enabled: boolean;
  server: string;
  path: string;
  username: string;
}

interface MailSettings {
  enabled: boolean;
  smtpServer: string;
  smtpPort: string;
  username: string;
  fromAddress: string;
}

interface ArchiveNumberingSettings {
  enabled: boolean;
  startingNumber: number;
  prefix: string;
}

const SystemSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ldap, setLdap] = useState<LdapSettings>({
    enabled: false, server: '', port: '389', baseDn: '', bindDn: '',
  });
  const [nas, setNas] = useState<NasSettings>({
    enabled: false, server: '', path: '', username: '',
  });
  const [mail, setMail] = useState<MailSettings>({
    enabled: false, smtpServer: '', smtpPort: '587', username: '', fromAddress: '',
  });
  const [archiveNumbering, setArchiveNumbering] = useState<ArchiveNumberingSettings>({
    enabled: true, startingNumber: 1, prefix: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('setting_key, setting_value');
      data?.forEach((s) => {
        const val = s.setting_value as Record<string, unknown>;
        if (s.setting_key === 'ldap') setLdap(prev => ({ ...prev, ...val }));
        if (s.setting_key === 'nas') setNas(prev => ({ ...prev, ...val }));
        if (s.setting_key === 'mail') setMail(prev => ({ ...prev, ...val }));
        if (s.setting_key === 'archive_numbering') setArchiveNumbering(prev => ({ ...prev, ...val }));
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (key: string, value: unknown) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('system_settings').upsert(
        [{ setting_key: key, setting_value: value as Json }],
        { onConflict: 'setting_key' }
      );
      if (error) throw error;
      toast({ title: 'Settings saved', description: `${key.replace('_', ' ').toUpperCase()} settings updated.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="w-7 h-7 text-primary" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure archive numbering, LDAP, NAS storage, and email</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <Tabs defaultValue="numbering" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="numbering"><Hash className="w-4 h-4 mr-2" />Numbering</TabsTrigger>
              <TabsTrigger value="ldap"><Lock className="w-4 h-4 mr-2" />LDAP</TabsTrigger>
              <TabsTrigger value="nas"><HardDrive className="w-4 h-4 mr-2" />NAS</TabsTrigger>
              <TabsTrigger value="mail"><Mail className="w-4 h-4 mr-2" />Email</TabsTrigger>
            </TabsList>

            <TabsContent value="numbering">
              <div className="card-stats space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <h3 className="font-semibold">Archive Sequential Numbering</h3>
                    <p className="text-sm text-muted-foreground">Configure how archives are numbered</p>
                  </div>
                  <Switch 
                    checked={archiveNumbering.enabled} 
                    onCheckedChange={(c) => setArchiveNumbering({ ...archiveNumbering, enabled: c })} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Starting Number</Label>
                    <Input 
                      type="number"
                      value={archiveNumbering.startingNumber} 
                      onChange={(e) => setArchiveNumbering({ ...archiveNumbering, startingNumber: parseInt(e.target.value) || 1 })} 
                      disabled={!archiveNumbering.enabled}
                      placeholder="e.g., 48001"
                    />
                    <p className="text-xs text-muted-foreground">
                      The next archive will get this number (then auto-increments)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prefix (Optional)</Label>
                    <Input 
                      value={archiveNumbering.prefix} 
                      onChange={(e) => setArchiveNumbering({ ...archiveNumbering, prefix: e.target.value })} 
                      disabled={!archiveNumbering.enabled}
                      placeholder="e.g., ARC-"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional prefix for archive numbers
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-accent/30">
                  <p className="text-sm">
                    <strong>Note:</strong> Doctors marked as "Local Archive" in the doctors management 
                    will be exempt from sequential numbering. Their archives will not receive a number.
                  </p>
                </div>
                <Button onClick={() => saveSetting('archive_numbering', archiveNumbering)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="ldap">
              <div className="card-stats space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div><h3 className="font-semibold">LDAP Authentication</h3></div>
                  <Switch checked={ldap.enabled} onCheckedChange={(c) => setLdap({ ...ldap, enabled: c })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Server</Label><Input value={ldap.server} onChange={(e) => setLdap({ ...ldap, server: e.target.value })} disabled={!ldap.enabled} /></div>
                  <div className="space-y-2"><Label>Port</Label><Input value={ldap.port} onChange={(e) => setLdap({ ...ldap, port: e.target.value })} disabled={!ldap.enabled} /></div>
                  <div className="space-y-2"><Label>Base DN</Label><Input value={ldap.baseDn} onChange={(e) => setLdap({ ...ldap, baseDn: e.target.value })} disabled={!ldap.enabled} /></div>
                  <div className="space-y-2"><Label>Bind DN</Label><Input value={ldap.bindDn} onChange={(e) => setLdap({ ...ldap, bindDn: e.target.value })} disabled={!ldap.enabled} /></div>
                </div>
                <Button onClick={() => saveSetting('ldap', ldap)} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
              </div>
            </TabsContent>

            <TabsContent value="nas">
              <div className="card-stats space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div><h3 className="font-semibold">NAS Storage</h3></div>
                  <Switch checked={nas.enabled} onCheckedChange={(c) => setNas({ ...nas, enabled: c })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Server</Label><Input value={nas.server} onChange={(e) => setNas({ ...nas, server: e.target.value })} disabled={!nas.enabled} /></div>
                  <div className="space-y-2"><Label>Path</Label><Input value={nas.path} onChange={(e) => setNas({ ...nas, path: e.target.value })} disabled={!nas.enabled} /></div>
                  <div className="col-span-2 space-y-2"><Label>Username</Label><Input value={nas.username} onChange={(e) => setNas({ ...nas, username: e.target.value })} disabled={!nas.enabled} /></div>
                </div>
                <Button onClick={() => saveSetting('nas', nas)} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
              </div>
            </TabsContent>

            <TabsContent value="mail">
              <div className="card-stats space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div><h3 className="font-semibold">Email Configuration</h3></div>
                  <Switch checked={mail.enabled} onCheckedChange={(c) => setMail({ ...mail, enabled: c })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>SMTP Server</Label><Input value={mail.smtpServer} onChange={(e) => setMail({ ...mail, smtpServer: e.target.value })} disabled={!mail.enabled} /></div>
                  <div className="space-y-2"><Label>Port</Label><Input value={mail.smtpPort} onChange={(e) => setMail({ ...mail, smtpPort: e.target.value })} disabled={!mail.enabled} /></div>
                  <div className="space-y-2"><Label>Username</Label><Input value={mail.username} onChange={(e) => setMail({ ...mail, username: e.target.value })} disabled={!mail.enabled} /></div>
                  <div className="space-y-2"><Label>From Address</Label><Input value={mail.fromAddress} onChange={(e) => setMail({ ...mail, fromAddress: e.target.value })} disabled={!mail.enabled} /></div>
                </div>
                <Button onClick={() => saveSetting('mail', mail)} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default SystemSettings;
