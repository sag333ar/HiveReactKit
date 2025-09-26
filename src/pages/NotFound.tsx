import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-8">
          <div className="text-8xl font-bold text-primary mb-4">404</div>
          <h1 className="text-2xl font-bold text-card-foreground mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-card-foreground rounded-lg hover:bg-card-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Home className="w-4 h-4" />
            Return Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
