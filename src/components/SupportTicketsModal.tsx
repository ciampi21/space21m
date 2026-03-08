import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, Clock, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: 'billing' | 'technical' | 'general' | 'account';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'closed';
  admin_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles?: {
    email: string;
    username: string | null;
  };
}

interface SupportTicketsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportTicketsModal({ open, onOpenChange }: SupportTicketsModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (open && isAdmin) {
      fetchTickets();
    }
  }, [open, isAdmin]);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchTerm, statusFilter, categoryFilter]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      // First get tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      // Then get user profiles
      const userIds = [...new Set(ticketsData?.map(ticket => ticket.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, username')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const ticketsWithProfiles = ticketsData?.map(ticket => ({
        ...ticket,
        profiles: profilesData?.find(profile => profile.user_id === ticket.user_id)
      })) || [];

      setTickets(ticketsWithProfiles as SupportTicket[]);
    } catch (error: any) {
      toast({
        title: t('support.error', 'Error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  };

  const handleUpdateTicket = async (ticketId: string, updates: Partial<SupportTicket>) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: t('support.ticketUpdated', 'Ticket updated'),
        description: t('support.ticketUpdatedDescription', 'The support ticket has been updated successfully.'),
      });

      fetchTickets();
      setSelectedTicket(null);
      setAdminResponse('');
    } catch (error: any) {
      toast({
        title: t('support.error', 'Error'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRespond = async () => {
    if (!selectedTicket || !adminResponse.trim()) return;

    await handleUpdateTicket(selectedTicket.id, {
      admin_response: adminResponse,
      status: 'in_progress',
      responded_at: new Date().toISOString(),
      responded_by: profile?.user_id
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'destructive';
      case 'in_progress': return 'default';
      case 'closed': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  if (!isAdmin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.adminRequired', 'Administrator privileges required')}</DialogTitle>
            <DialogDescription>
              {t('admin.adminRequiredDescription', 'You need administrator privileges to access this feature.')}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('support.ticketManagement', 'Support Ticket Management')}
          </DialogTitle>
          <DialogDescription>
            {t('support.ticketManagementDescription', 'Manage and respond to user support requests')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-[70vh]">
          {/* Filters */}
          <div className="flex gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="search">{t('admin.search', 'Search')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('support.searchPlaceholder', 'Search tickets...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-40">
              <Label htmlFor="status">{t('support.status.label', 'Status')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.all', 'All')}</SelectItem>
                  <SelectItem value="open">{t('support.statusOpen', 'Open')}</SelectItem>
                  <SelectItem value="in_progress">{t('support.statusInProgress', 'In Progress')}</SelectItem>
                  <SelectItem value="closed">{t('support.statusClosed', 'Closed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Label htmlFor="category">{t('support.category', 'Category')}</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.all', 'All')}</SelectItem>
                  <SelectItem value="general">{t('support.categoryGeneral', 'General')}</SelectItem>
                  <SelectItem value="billing">{t('support.categoryBilling', 'Billing')}</SelectItem>
                  <SelectItem value="technical">{t('support.categoryTechnical', 'Technical')}</SelectItem>
                  <SelectItem value="account">{t('support.categoryAccount', 'Account')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Tickets List */}
            <div className="space-y-4 overflow-y-auto pr-2">
              <h3 className="font-semibold text-lg">
                {t('support.tickets', 'Support Tickets')} ({filteredTickets.length})
              </h3>
              
              {filteredTickets.map((ticket) => (
                <Card 
                  key={ticket.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedTicket?.id === ticket.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{ticket.subject}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant={getStatusColor(ticket.status)}>
                          {t(`support.status${ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace('_', '')}`, ticket.status)}
                        </Badge>
                        <Badge variant={getPriorityColor(ticket.priority)}>
                          {t(`support.priority${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}`, ticket.priority)}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {ticket.profiles?.email} • {format(new Date(ticket.created_at), 'MMM dd, yyyy HH:mm')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.message}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {filteredTickets.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('support.noTickets', 'No support tickets found')}
                </div>
              )}
            </div>

            {/* Ticket Details */}
            <div className="border rounded-lg overflow-hidden">
              {selectedTicket ? (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b bg-muted/50">
                    <h3 className="font-semibold">{selectedTicket.subject}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedTicket.profiles?.email} • {format(new Date(selectedTicket.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">{t('support.originalMessage', 'Original Message')}</h4>
                      <div className="bg-muted/50 p-3 rounded">
                        <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                      </div>
                    </div>

                    {selectedTicket.admin_response && (
                      <div>
                        <h4 className="font-medium mb-2">{t('support.adminResponse', 'Admin Response')}</h4>
                        <div className="bg-blue-50 p-3 rounded border">
                          <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_response}</p>
                          {selectedTicket.responded_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {t('support.respondedAt', 'Responded at')}: {format(new Date(selectedTicket.responded_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedTicket.status !== 'closed' && (
                      <div className="space-y-3">
                        <Label htmlFor="response">{t('support.response', 'Response')}</Label>
                        <Textarea
                          id="response"
                          value={adminResponse}
                          onChange={(e) => setAdminResponse(e.target.value)}
                          placeholder={t('support.responsePlaceholder', 'Type your response here...')}
                          className="min-h-[100px]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t bg-muted/50 flex gap-2">
                    {selectedTicket.status !== 'closed' && (
                      <>
                        <Button onClick={handleRespond} disabled={!adminResponse.trim()}>
                          {t('support.respond', 'Respond')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'closed' })}
                        >
                          {t('support.closeTicket', 'Close Ticket')}
                        </Button>
                      </>
                    )}
                    
                    {selectedTicket.status === 'closed' && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleUpdateTicket(selectedTicket.id, { status: 'open' })}
                      >
                        {t('support.reopenTicket', 'Reopen Ticket')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('support.selectTicket', 'Select a ticket to view details')}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}