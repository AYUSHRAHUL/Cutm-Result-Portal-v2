/**
 * SOVET Backlog Admin Page
 * Route: /dashboard/admin/backlog?school=SOVET&campus=pkd|bbsr
 * Enhanced with Centurion University registration number system
 */

import SOVETBacklogManager from '@/components/SOVETBacklogManager';

export const metadata = {
  title: 'SOVET Backlog Management',
  description: 'Manage student backlogs with Centurion University registration system'
};

export default function BacklogPage() {
  return <SOVETBacklogManager />;
}
