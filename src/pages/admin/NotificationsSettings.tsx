import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Bell, Send, Save, Loader2, Smartphone } from 'lucide-react';

interface ViberSettings { enabled: boolean; apiKey: string; senderId: string; }
interface TelegramSettings { enabled: boolean; botToken: string; chatId: string; }

const NotificationsSettings = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viber, setViber] = useState<ViberSettings>({ enabled: false, apiKey: '', senderId: '' });
  const [telegram, setTelegram] = useState<TelegramSettings>({ enabled: false, botToken: '', chatId: '' });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('setting_key, setting_value').in('setting_key', ['viber', 'telegram']);
      data?.forEach((s) => {
        const val = s.setting_value as Record<string, unknown>;
        if (s.setting_key === 'viber') setViber(prev => ({ ...prev, ...val }));
        if (s.setting_key === 'telegram') setTelegram(prev => ({ ...prev, ...val }));
      });
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const saveSetting = async (key: string, value: unknown) => {
    setIsSaving(true);
    try {
      await supabase.from('system_settings').upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' });
      toast({ title: 'Saved', description: `${key} settings updated.` });
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Bell className="w-7 h-7 text-primary" />Notifications</h1>
          <p className="text-muted-foreground mt-1">Configure Viber and Telegram notifications</p>
        </div>
        {isLoading ? <div className="text-center py-8">Loading...</div> : (
          <Tabs defaultValue="viber" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="viber"><Smartphone className="w-4 h-4 mr-2" />Viber</TabsTrigger>
              <TabsTrigger value="telegram"><Send className="w-4 h-4 mr-2" />Telegram</TabsTrigger>
            </TabsList>
            <TabsContent value="viber">
              <div className="card-stats space-y-6">
                <div className="flex items-center justify-between pb-4 border-b"><h3 className="font-semibold">Viber</h3><Switch checked={viber.enabled} onCheckedChange={(c) => setViber({ ...viber, enabled: c })} /></div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>API Key</Label><Input type="password" value={viber.apiKey} onChange={(e) => setViber({ ...viber, apiKey: e.target.value })} disabled={!viber.enabled} /></div>
                  <div className="space-y-2"><Label>Sender ID</Label><Input value={viber.senderId} onChange={(e) => setViber({ ...viber, senderId: e.target.value })} disabled={!viber.enabled} /></div>
                </div>
                <Button onClick={() => saveSetting('viber', viber)} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
              </div>
            </TabsContent>
            <TabsContent value="telegram">
              <div className="card-stats space-y-6">
                <div className="flex items-center justify-between pb-4 border-b"><h3 className="font-semibold">Telegram</h3><Switch checked={telegram.enabled} onCheckedChange={(c) => setTelegram({ ...telegram, enabled: c })} /></div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Bot Token</Label><Input type="password" value={telegram.botToken} onChange={(e) => setTelegram({ ...telegram, botToken: e.target.value })} disabled={!telegram.enabled} /></div>
                  <div className="space-y-2"><Label>Chat ID</Label><Input value={telegram.chatId} onChange={(e) => setTelegram({ ...telegram, chatId: e.target.value })} disabled={!telegram.enabled} /></div>
                </div>
                <Button onClick={() => saveSetting('telegram', telegram)} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save</Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default NotificationsSettings;
