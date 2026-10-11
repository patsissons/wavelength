import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <main className="safe-area flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-4xl font-bold tracking-tight">Wavelength</h1>
      <p className="text-muted-foreground">Read your friends&apos; minds.</p>
      <Button size="lg">Host a game</Button>
    </main>
  );
}
