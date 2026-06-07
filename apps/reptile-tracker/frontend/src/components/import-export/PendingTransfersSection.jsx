import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ExternalLink, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/utils/dateFormatting';

/**
 * Settings section showing pending transfer reptiles per D-18/D-19.
 * Allows completing (delete) or cancelling pending transfers.
 */
export default function PendingTransfersSection() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, reptile: null });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/exports/transfers/pending');
      setTransfers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch pending transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (reptileId) => {
    setActionLoading(true);
    try {
      await axios.post(`/api/exports/transfers/${reptileId}/complete`);
      toast.success('Transfer completed - reptile has been removed');
      setTransfers(prev => prev.filter(t => t.id !== reptileId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete transfer');
    } finally {
      setActionLoading(false);
      setConfirmDialog({ open: false, type: null, reptile: null });
    }
  };

  const handleCancel = async (reptileId) => {
    setActionLoading(true);
    try {
      await axios.post(`/api/exports/transfers/${reptileId}/cancel`);
      toast.success('Transfer cancelled');
      setTransfers(prev => prev.filter(t => t.id !== reptileId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel transfer');
    } finally {
      setActionLoading(false);
      setConfirmDialog({ open: false, type: null, reptile: null });
    }
  };

  // Don't show section if no pending transfers
  if (!loading && transfers.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-amber-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-amber-500" />
            <CardTitle>Pending Transfers</CardTitle>
          </div>
          <CardDescription>
            These reptiles have been exported for transfer. Complete the transfer to remove them, or cancel to keep them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{transfer.name}</div>
                      <div className="text-sm text-muted-foreground">{transfer.species}</div>
                      {transfer.transfer_exported_at && (
                        <div className="text-xs text-muted-foreground">
                          Exported {formatDate(transfer.transfer_exported_at)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="pending-transfer">Pending Transfer</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDialog({ open: true, type: 'cancel', reptile: transfer })}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDialog({ open: true, type: 'complete', reptile: transfer })}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: null, reptile: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'complete' ? 'Complete Transfer?' : 'Cancel Transfer?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'complete'
                ? `This will permanently delete ${confirmDialog.reptile?.name} and all their data. This cannot be undone.`
                : `This will cancel the pending transfer for ${confirmDialog.reptile?.name}. The reptile will remain in your household.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.type === 'complete'
                ? handleComplete(confirmDialog.reptile?.id)
                : handleCancel(confirmDialog.reptile?.id)
              }
              disabled={actionLoading}
              className={confirmDialog.type === 'complete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {actionLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              ) : (
                confirmDialog.type === 'complete' ? 'Delete Permanently' : 'Cancel Transfer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
