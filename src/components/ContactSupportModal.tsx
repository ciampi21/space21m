import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageCircle, Clock, CheckCircle2, Plus } from 'lucide-react';

interface ContactSupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  admin_response?: string;
  responded_at?: string;
  user_reply?: string;
  user_replied_at?: string;
}

interface ReplyFormProps {
  ticketId: string;
  onReplySubmitted: () => void;
}

function ReplyForm({ ticketId, onReplySubmitted }: ReplyFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reply, setReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reply.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          user_reply: reply,
          user_replied_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: t('support.replySubmitted', 'Reply submitted'),
        description: t('support.replySubmittedDescription', 'Your reply has been sent to support.'),
      });

      setReply('');
      onReplySubmitted();
    } catch (error: any) {
      toast({
        title: t('support.error', 'Error'),
        description: error.message || t('support.replyError', 'Failed to submit reply'),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="reply">
          {t('support.replyToSupport', 'Reply to Support')}
        </Label>
        <Textarea
          id="reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={t('support.replyPlaceholder', 'Type your reply here...')}
          className="min-h-[80px] mt-1"
          required
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !reply.trim()} size="sm">
        {isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        {t('support.submitReply', 'Submit Reply')}
      </Button>
    </form>
  );
}

export function ContactSupportModal({ open, onOpenChange }: ContactSupportModalProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTab, setActiveTab] = useState('tickets');
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'general' as 'billing' | 'technical' | 'general' | 'account'
  });

  // Fetch user's support tickets
  const fetchTickets = async () => {
    if (!user) return;
    
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchTickets();
    }
  }, [open, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      // Create support ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: formData.subject,
          message: formData.message,
          category: formData.category
        })
        .select()
        .single();

      if (ticketError) {
        throw ticketError;
      }

      // Send notification email to support
      const { error: emailError } = await supabase.functions.invoke('send-support-notification', {
        body: {
          ticketId: ticket.id,
          subject: formData.subject,
          message: formData.message,
          category: formData.category,
          userEmail: profile?.email || user.email,
          userName: profile?.username || 'User'
        }
      });

      if (emailError) {
        console.error('Failed to send support email:', emailError);
        // Don't throw here - ticket was created successfully
      }

      toast({
        title: t('support.ticketCreated', 'Support ticket created'),
        description: t('support.ticketCreatedDescription', 'We have received your message and will get back to you soon.'),
      });

      // Reset form
      setFormData({
        subject: '',
        message: '',
        category: 'general'
      });

      // Refresh tickets list and switch to tickets tab
      await fetchTickets();
      setActiveTab('tickets');
    } catch (error: any) {
      toast({
        title: t('support.error', 'Error'),
        description: error.message || t('support.submitError', 'Failed to submit support request'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4" />;
      case 'closed':
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'default';
      case 'closed':
      case 'resolved':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'billing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'technical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'account':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('support.contactSupport', 'Contact Support')}
          </DialogTitle>
          <DialogDescription>
            {t('support.contactSupportDescription', 'View your existing tickets or create a new support request.')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              {t('support.myTickets', 'My Tickets')}
              {tickets.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {tickets.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('support.newTicket', 'New Ticket')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="mt-4">
            <ScrollArea className="h-[400px] w-full">
              {loadingTickets ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {t('support.noTickets', 'No support tickets found. Create your first ticket using the "New Ticket" tab.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{ticket.subject}</CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusVariant(ticket.status)} className="flex items-center gap-1">
                                {getStatusIcon(ticket.status)}
                                {t(`support.status${ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}`, ticket.status)}
                              </Badge>
                              <Badge className={getCategoryColor(ticket.category)}>
                                {t(`support.category${ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}`, ticket.category)}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                              {t('support.originalMessage', 'Original Message')}:
                            </p>
                            <p className="text-sm">{ticket.message}</p>
                          </div>
                          
                          {ticket.admin_response && (
                            <div className="border-l-4 border-primary pl-4 bg-muted/50 p-3 rounded-r-md">
                              <p className="text-sm font-medium text-primary mb-1">
                                {t('support.adminResponse', 'Support Response')}:
                              </p>
                              <p className="text-sm">{ticket.admin_response}</p>
                              {ticket.responded_at && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {t('support.respondedAt', 'Responded at')}: {new Date(ticket.responded_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {ticket.user_reply && (
                            <div className="border-l-4 border-secondary pl-4 bg-secondary/20 p-3 rounded-r-md mt-3">
                              <p className="text-sm font-medium text-secondary-foreground mb-1">
                                {t('support.yourReply', 'Your Reply')}:
                              </p>
                              <p className="text-sm">{ticket.user_reply}</p>
                              {ticket.user_replied_at && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  {t('support.repliedAt', 'Replied at')}: {new Date(ticket.user_replied_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {ticket.admin_response && (ticket.status === 'open' || ticket.status === 'in_progress') && !ticket.user_reply && (
                            <div className="mt-3">
                              <ReplyForm ticketId={ticket.id} onReplySubmitted={fetchTickets} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">
                    {t('support.category', 'Category')}
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{t('support.categoryGeneral', 'General')}</SelectItem>
                      <SelectItem value="billing">{t('support.categoryBilling', 'Billing')}</SelectItem>
                      <SelectItem value="technical">{t('support.categoryTechnical', 'Technical')}</SelectItem>
                      <SelectItem value="account">{t('support.categoryAccount', 'Account')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    {t('support.email', 'Email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">
                  {t('support.subject', 'Subject')} *
                </Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder={t('support.subjectPlaceholder', 'Brief description of your issue')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  {t('support.message', 'Message')} *
                </Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={t('support.messagePlaceholder', 'Please describe your issue in detail...')}
                  className="min-h-[120px]"
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('support.sendMessage', 'Send Message')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}