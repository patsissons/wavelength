import { BrowserRouter, Route, Routes } from "react-router";
import { EggsLayer } from "@/components/eggs/eggs-layer";
import { Toaster } from "@/components/ui/sonner";
import { Game } from "@/routes/game";
import { Home } from "@/routes/home";
import { Join } from "@/routes/join";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/game/:code" element={<Game />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <EggsLayer />
      <Toaster />
    </BrowserRouter>
  );
}
