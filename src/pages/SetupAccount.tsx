
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SetupAccount = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [profileData, setProfileData] = useState<any>(null);

  // Validate token and get email
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        toast({
          title: "Erro",
          description: "Token de configuração não encontrado",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      try {
        // Use edge function to validate token (bypasses RLS)
        const { data, error } = await supabase.functions.invoke("validate-setup-token", {
          body: { token }
        });

        if (error || !data || data.error) {
          toast({
            title: "Erro",
            description: data?.error || "Token inválido ou não encontrado",
            variant: "destructive",
          });
          navigate("/auth");
          return;
        }

        setEmail(data.email);
        setProfileData({ email: data.email, user_id: data.user_id });
        setTokenValid(true);
      } catch (error) {
        console.error("Error validating token:", error);
        toast({
          title: "Erro",
          description: "Erro ao validar token",
          variant: "destructive",
        });
        navigate("/auth");
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [token, navigate, toast]);

  const handleSetupAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!username.trim()) {
      toast({
        title: "Erro",
        description: "Nome de usuário é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use edge function to complete setup securely
      const { data, error } = await supabase.functions.invoke("complete-setup", {
        body: { 
          token: token,
          username: username,
          password: password
        }
      });

      if (error || !data || data.error) {
        throw new Error(data?.error || "Erro ao configurar conta");
      }

      toast({
        title: "Sucesso!",
        description: "Conta configurada com sucesso. Fazendo login...",
      });

      // Auto login after setup
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        toast({
          title: "Conta criada com sucesso!",
          description: "Você pode fazer login agora com suas credenciais.",
        });
        navigate("/auth");
      } else {
        // After successful login, check for pending invitation
        const storedToken = localStorage.getItem('accept_invite_token');
        if (storedToken) {
          try {
            console.log('Accepting invitation after setup with token:', storedToken);
            
            // Wait a moment to ensure session is fully established
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const { data: acceptData, error: acceptError } = await supabase.functions.invoke('accept-invitation', {
              body: { token: storedToken },
            });
            
            console.log('Accept invitation response:', { data: acceptData, error: acceptError });
            
            if (acceptError) {
              console.error('Network error accepting invitation:', acceptError);
              toast({
                title: "Erro ao aceitar convite",
                description: `Erro de rede: ${acceptError.message || "Erro interno"}`,
                variant: "destructive",
              });
            } else if (acceptData?.error) {
              console.error('Server error accepting invitation:', acceptData.error);
              toast({
                title: "Erro ao aceitar convite", 
                description: `Erro do servidor: ${acceptData.error}`,
                variant: "destructive",
              });
            } else if (acceptData?.workspace?.id) {
              console.log('Invitation accepted successfully, redirecting to workspace:', acceptData.workspace.id);
              localStorage.removeItem('accept_invite_token');
              toast({
                title: "Convite aceito!",
                description: `Você foi adicionado ao workspace "${acceptData.workspace.name}".`,
              });
              navigate(`/workspace/${acceptData.workspace.id}`);
              return;
            } else {
              console.warn('Unexpected response format:', acceptData);
              toast({
                title: "Aviso",
                description: "Resposta inesperada do servidor ao aceitar convite.",
                variant: "destructive",
              });
            }
            
            // Clean up token even if there was an error
            localStorage.removeItem('accept_invite_token');
          } catch (error: any) {
            console.error('Exception accepting invitation:', error);
            toast({
              title: "Erro ao aceitar convite",
              description: `Exceção: ${error.message || 'Erro desconhecido'}`,
              variant: "destructive",
            });
            localStorage.removeItem('accept_invite_token');
          }
        }
        navigate("/dashboard");
      }

    } catch (error: any) {
      console.error("Setup error:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao configurar conta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-outer p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Validando link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-outer p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">🔧 Configurar Conta</CardTitle>
          <CardDescription className="text-center">
            Complete seu cadastro criando um nome de usuário e senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetupAccount} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Este é o email associado à sua compra
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nome de usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite seu nome de usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Configurando..." : "Configurar Conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupAccount;
