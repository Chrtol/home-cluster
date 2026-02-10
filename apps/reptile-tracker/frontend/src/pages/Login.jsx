import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Login() {
  const handleLogin = () => {
    window.location.href = '/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">🦎</div>
          <CardTitle className="text-3xl">Reptile Tracker</CardTitle>
          <CardDescription>
            Track feeding schedules, weight, and health for your reptiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} className="w-full" size="lg">
            Login with Single Sign-On
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
