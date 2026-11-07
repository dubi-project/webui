import Console from './Console';
import { NotificationPreviewProvider } from './NotificationsPreview';
export default function PreviewConsole() { return <NotificationPreviewProvider><Console preview/></NotificationPreviewProvider>; }
