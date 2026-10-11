import { Toaster as Sonner, type ToasterProps } from "sonner";

// The app is dark-only, so the toaster is pinned to the dark theme rather
// than reading next-themes.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-center"
      {...props}
    />
  );
};

export { Toaster };
