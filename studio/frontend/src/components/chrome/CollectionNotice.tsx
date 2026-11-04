import { ExternalLink, Monitor } from "lucide-react";

export function CollectionNotice({ action }: { action: string }) {
  return <div className="collection-notice"><Monitor size={18} /><div><strong>You’re browsing the saved collection</strong><p>{action} uses the local workspace and its connected model provider.</p></div><a href="http://localhost:3000" target="_blank" rel="noreferrer">Open local workspace<ExternalLink size={13} /></a></div>;
}
