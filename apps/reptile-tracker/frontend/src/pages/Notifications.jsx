import { useSearchParams } from 'react-router-dom';
import { Bell, FileText, Settings as SettingsIcon, AlertTriangle, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Notifications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'global'; // Default to global

  const handleTabChange = (value) => {
    // Preserve other query params when changing tab
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', value);
    setSearchParams(newParams);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-foreground">Notifications</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start mb-6 overflow-x-auto">
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Bell size={18} />
            Channels
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText size={18} />
            Templates
          </TabsTrigger>
          <TabsTrigger value="global" className="flex items-center gap-2">
            <SettingsIcon size={18} />
            Global Settings
          </TabsTrigger>
          <TabsTrigger value="reptiles" className="flex items-center gap-2">
            <AlertTriangle size={18} />
            Reptile Alerts
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <Calendar size={18} />
            Schedule Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <div className="text-muted-foreground">Channels tab - coming in Plan 02</div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="text-muted-foreground">Templates tab - coming in Plan 02</div>
        </TabsContent>

        <TabsContent value="global">
          <div className="text-muted-foreground">Global Settings tab - coming in Plan 02</div>
        </TabsContent>

        <TabsContent value="reptiles">
          <div className="text-muted-foreground">Reptile Alerts tab - coming in Plan 02</div>
        </TabsContent>

        <TabsContent value="schedules">
          <div className="text-muted-foreground">Schedule Notifications tab - coming in Plan 02</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
