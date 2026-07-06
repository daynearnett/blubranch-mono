import { termsOfService } from '@blubranch/shared';
import { LegalDocumentView } from '../../src/components/legal-document-view.js';

export default function TermsScreen() {
  return <LegalDocumentView doc={termsOfService} />;
}
