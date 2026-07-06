import { privacyPolicy } from '@blubranch/shared';
import { LegalDocumentView } from '../../src/components/legal-document-view.js';

export default function PrivacyScreen() {
  return <LegalDocumentView doc={privacyPolicy} />;
}
