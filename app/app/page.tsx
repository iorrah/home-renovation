import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder until the login flow arrives in the next step.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Home Renovation</CardTitle>
          <CardDescription>Contractors and homeowners, on the same page.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Badge variant="secondary">Theme check</Badge>
        </CardContent>
      </Card>
    </main>
  );
}
