import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Measurements() {
  const { reptileId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to unified Health Log page with reptile pre-selected
    if (reptileId) {
      navigate(`/health-log/${reptileId}?log_type=weight`, { replace: true });
    } else {
      navigate('/health-log?log_type=weight', { replace: true });
    }
  }, [reptileId, navigate]);

  // Show brief loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Health Log...</p>
    </div>
  );
}
