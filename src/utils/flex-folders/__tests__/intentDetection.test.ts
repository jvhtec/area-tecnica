import { describe, it, expect } from 'vitest';
import {
  detectFlexLinkIntent,
  isFinancialDocument,
  isCrewCall,
  isEquipmentList,
  isSimpleFolder,
  isSimpleProjectElement,
} from '../intentDetection';
import { FLEX_FOLDER_IDS } from '../constants';

describe('detectFlexLinkIntent', () => {
  it('should detect simple-element for no context', () => {
    const intent = detectFlexLinkIntent();
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for empty context', () => {
    const intent = detectFlexLinkIntent({});
    expect(intent).toBe('simple-element');
  });

  it('should detect fin-doc for presupuesto definitionId', () => {
    const intent = detectFlexLinkIntent({
      definitionId: FLEX_FOLDER_IDS.presupuesto,
    });
    expect(intent).toBe('fin-doc');
  });

  it('should detect fin-doc for hojaGastos definitionId', () => {
    const intent = detectFlexLinkIntent({
      definitionId: FLEX_FOLDER_IDS.hojaGastos,
    });
    expect(intent).toBe('fin-doc');
  });

  it('should detect contact-list for crewCall definitionId', () => {
    const intent = detectFlexLinkIntent({
      definitionId: FLEX_FOLDER_IDS.crewCall,
    });
    expect(intent).toBe('contact-list');
  });

  it('should detect equipment-list for pullSheet definitionId', () => {
    const intent = detectFlexLinkIntent({
      definitionId: FLEX_FOLDER_IDS.pullSheet,
    });
    expect(intent).toBe('equipment-list');
  });

  it('should detect simple-element for mainFolder definitionId', () => {
    const intent = detectFlexLinkIntent({
      definitionId: FLEX_FOLDER_IDS.mainFolder,
    });
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for subFolder definitionId', () => {
    const intent = detectFlexLinkIntent({
      definitionId: FLEX_FOLDER_IDS.subFolder,
    });
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for simple-project-element domainId', () => {
    const intent = detectFlexLinkIntent({
      domainId: 'simple-project-element',
    });
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for dryhire folderType', () => {
    const intent = detectFlexLinkIntent({
      folderType: 'dryhire',
    });
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for tourdate folderType', () => {
    const intent = detectFlexLinkIntent({
      folderType: 'tourdate',
    });
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for dryhire jobType', () => {
    const intent = detectFlexLinkIntent({
      jobType: 'dryhire',
    });
    expect(intent).toBe('simple-element');
  });

  it('should detect simple-element for tourdate jobType', () => {
    const intent = detectFlexLinkIntent({
      jobType: 'tourdate',
    });
    expect(intent).toBe('simple-element');
  });

  it('should prioritize viewHint over definitionId', () => {
    const intent = detectFlexLinkIntent({
      viewHint: 'contact-list',
      definitionId: FLEX_FOLDER_IDS.presupuesto,
    });
    expect(intent).toBe('contact-list');
  });

  it('should ignore viewHint when set to auto', () => {
    const intent = detectFlexLinkIntent({
      viewHint: 'auto',
      definitionId: FLEX_FOLDER_IDS.presupuesto,
    });
    expect(intent).toBe('fin-doc');
  });

  it('should detect remote-file-list from viewHint', () => {
    const intent = detectFlexLinkIntent({
      viewHint: 'remote-file-list',
    });
    expect(intent).toBe('remote-file-list');
  });

  it('should detect equipment-list from viewHint', () => {
    const intent = detectFlexLinkIntent({
      viewHint: 'equipment-list',
    });
    expect(intent).toBe('equipment-list');
  });
});

describe('isFinancialDocument', () => {
  it('should return true for presupuesto', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.presupuesto)).toBe(true);
  });

  it('should return true for presupuestoDryHire', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.presupuestoDryHire)).toBe(true);
  });

  it('should return true for hojaGastos', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.hojaGastos)).toBe(true);
  });

  it('should return true for ordenCompra', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.ordenCompra)).toBe(true);
  });

  it('should return false for crewCall', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.crewCall)).toBe(false);
  });

  it('should return false for pullSheet', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.pullSheet)).toBe(false);
  });

  it('should return false for mainFolder', () => {
    expect(isFinancialDocument(FLEX_FOLDER_IDS.mainFolder)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isFinancialDocument(undefined)).toBe(false);
  });
});

describe('isCrewCall', () => {
  it('should return true for crewCall', () => {
    expect(isCrewCall(FLEX_FOLDER_IDS.crewCall)).toBe(true);
  });

  it('should return false for presupuesto', () => {
    expect(isCrewCall(FLEX_FOLDER_IDS.presupuesto)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isCrewCall(undefined)).toBe(false);
  });
});

describe('isEquipmentList', () => {
  it('should return true for pullSheet', () => {
    expect(isEquipmentList(FLEX_FOLDER_IDS.pullSheet)).toBe(true);
  });

  it('should return false for presupuesto', () => {
    expect(isEquipmentList(FLEX_FOLDER_IDS.presupuesto)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isEquipmentList(undefined)).toBe(false);
  });
});

describe('isSimpleFolder', () => {
  it('should return true for mainFolder', () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.mainFolder)).toBe(true);
  });

  it('should return true for subFolder', () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.subFolder)).toBe(true);
  });

  it('should return false for presupuesto', () => {
    expect(isSimpleFolder(FLEX_FOLDER_IDS.presupuesto)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isSimpleFolder(undefined)).toBe(false);
  });
});

describe('isSimpleProjectElement', () => {
  it('should return true for simple-project-element domainId', () => {
    expect(isSimpleProjectElement('simple-project-element')).toBe(true);
  });

  it('should return false for other domainId', () => {
    expect(isSimpleProjectElement('other-domain')).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isSimpleProjectElement(undefined)).toBe(false);
  });
});
