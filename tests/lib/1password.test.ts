import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock the SDK ─────────────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
const mockList = vi.fn();

const mockClient = {
  items: {
    create: mockCreate,
    get: mockGet,
    put: mockPut,
    delete: mockDelete,
    list: mockList,
  },
};

vi.mock('@1password/sdk', () => ({
  createClient: vi.fn().mockResolvedValue(mockClient),
  ItemCategory: {
    CreditCard: 'CreditCard',
    Identity: 'Identity',
    SecureNote: 'SecureNote',
  },
  ItemFieldType: {
    Text: 'Text',
    Concealed: 'Concealed',
    CreditCardNumber: 'CreditCardNumber',
    CreditCardType: 'CreditCardType',
    MonthYear: 'MonthYear',
    Date: 'Date',
  },
}));

// ─── Reset module + env between tests ────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.ONEPASSWORD_SERVICE_ACCOUNT_TOKEN = 'test-token';
  process.env.ONEPASSWORD_VAULT_ID = 'test-vault-id';
});

afterEach(() => {
  delete process.env.ONEPASSWORD_SERVICE_ACCOUNT_TOKEN;
  delete process.env.ONEPASSWORD_VAULT_ID;
});

// ─── Client initialisation ───────────────────────────────────────────────────

describe('getOpClient', () => {
  it('throws if OP_SERVICE_ACCOUNT_TOKEN is missing', async () => {
    delete process.env.ONEPASSWORD_SERVICE_ACCOUNT_TOKEN;
    const { getOpClient } = await import('../../lib/1password');
    await expect(getOpClient()).rejects.toThrow(
      'ONEPASSWORD_SERVICE_ACCOUNT_TOKEN is not set',
    );
  });

  it('returns a client when token is present', async () => {
    const { getOpClient } = await import('../../lib/1password');
    const client = await getOpClient();
    expect(client).toBe(mockClient);
  });
});

// ─── getVaultId ───────────────────────────────────────────────────────────────

describe('getVaultId', () => {
  it('throws if ONEPASSWORD_VAULT_ID is missing', async () => {
    delete process.env.ONEPASSWORD_VAULT_ID;
    const { getVaultId } = await import('../../lib/1password');
    expect(() => getVaultId()).toThrow('ONEPASSWORD_VAULT_ID is not set');
  });

  it('returns vault ID from env', async () => {
    const { getVaultId } = await import('../../lib/1password');
    expect(getVaultId()).toBe('test-vault-id');
  });
});

// ─── Generic item operations ─────────────────────────────────────────────────

describe('getItem', () => {
  it('calls client.items.get with correct args', async () => {
    const mockItem = { id: 'item-1', title: 'Test' };
    mockGet.mockResolvedValue(mockItem);
    const { getItem } = await import('../../lib/1password');
    const result = await getItem('vault-1', 'item-1');
    expect(mockGet).toHaveBeenCalledWith('vault-1', 'item-1');
    expect(result).toEqual(mockItem);
  });
});

describe('updateItem', () => {
  it('calls client.items.put with the item', async () => {
    const mockItem = { id: 'item-1', title: 'Updated' };
    mockPut.mockResolvedValue(mockItem);
    const { updateItem } = await import('../../lib/1password');
    const result = await updateItem(mockItem as any);
    expect(mockPut).toHaveBeenCalledWith(mockItem);
    expect(result).toEqual(mockItem);
  });
});

describe('deleteItem', () => {
  it('calls client.items.delete with vault + item IDs', async () => {
    mockDelete.mockResolvedValue(undefined);
    const { deleteItem } = await import('../../lib/1password');
    await deleteItem('vault-1', 'item-1');
    expect(mockDelete).toHaveBeenCalledWith('vault-1', 'item-1');
  });
});

describe('listItems', () => {
  it('calls client.items.list with vault ID', async () => {
    mockList.mockResolvedValue([]);
    const { listItems } = await import('../../lib/1password');
    await listItems('vault-1');
    expect(mockList).toHaveBeenCalledWith('vault-1');
  });
});

// ─── createCardItem ───────────────────────────────────────────────────────────

describe('createCardItem', () => {
  const baseParams = {
    clientName: 'Sarah Merriman',
    cardholderName: 'SARAH MERRIMAN',
    cardNumber: '4111 1111 1111 1234',
    expiry: '12/2028',
    cvv: '123',
    cardType: 'Visa',
    billingAddress: '123 Main St, New York, NY 10001',
    notes: 'Primary travel card',
  };

  it('creates a credit card item with correct title', async () => {
    const mockItem = { id: 'card-1', title: 'Visa ••••1234 — Sarah Merriman' };
    mockCreate.mockResolvedValue(mockItem);
    const { createCardItem } = await import('../../lib/1password');
    const result = await createCardItem('vault-1', baseParams);
    expect(result.title).toBe('Visa ••••1234 — Sarah Merriman');
  });

  it('passes vaultId and CreditCard category', async () => {
    mockCreate.mockResolvedValue({});
    const { createCardItem } = await import('../../lib/1password');
    await createCardItem('vault-1', baseParams);
    const call = mockCreate.mock.calls[0][0];
    expect(call.vaultId).toBe('vault-1');
    expect(call.category).toBe('CreditCard');
  });

  it('includes sojourns and card tags', async () => {
    mockCreate.mockResolvedValue({});
    const { createCardItem } = await import('../../lib/1password');
    await createCardItem('vault-1', baseParams);
    const call = mockCreate.mock.calls[0][0];
    expect(call.tags).toContain('sojourns');
    expect(call.tags).toContain('card');
  });

  it('stores card number with spaces stripped', async () => {
    mockCreate.mockResolvedValue({});
    const { createCardItem } = await import('../../lib/1password');
    await createCardItem('vault-1', baseParams);
    const fields = mockCreate.mock.calls[0][0].fields;
    const numberField = fields.find((f: any) => f.id === 'card_number');
    expect(numberField.value).toBe('4111111111111234');
  });

  it('uses Concealed type for CVV', async () => {
    mockCreate.mockResolvedValue({});
    const { createCardItem } = await import('../../lib/1password');
    await createCardItem('vault-1', baseParams);
    const fields = mockCreate.mock.calls[0][0].fields;
    const cvvField = fields.find((f: any) => f.id === 'cvv');
    expect(cvvField.fieldType).toBe('Concealed');
  });

  it('omits card_type field when cardType not provided', async () => {
    mockCreate.mockResolvedValue({});
    const { createCardItem } = await import('../../lib/1password');
    const { cardType, ...noType } = baseParams;
    await createCardItem('vault-1', noType);
    const fields = mockCreate.mock.calls[0][0].fields;
    expect(fields.find((f: any) => f.id === 'card_type')).toBeUndefined();
  });

  it('uses generic title when cardType not provided', async () => {
    mockCreate.mockResolvedValue({ title: 'Card ••••1234 — Sarah Merriman' });
    const { createCardItem } = await import('../../lib/1password');
    const { cardType, ...noType } = baseParams;
    await createCardItem('vault-1', noType);
    const call = mockCreate.mock.calls[0][0];
    expect(call.title).toBe('Card ••••1234 — Sarah Merriman');
  });
});

// ─── createPassportItem ───────────────────────────────────────────────────────

describe('createPassportItem', () => {
  const baseParams = {
    clientName: 'Sarah Merriman',
    givenNames: 'Sarah Jane',
    surname: 'Merriman',
    passportNumber: 'A12345678',
    nationality: 'American',
    placeOfBirth: 'New York, USA',
    dateOfBirth: '1985-04-12',
    issueDate: '2020-06-01',
    expiryDate: '2030-06-01',
    issuingCountry: 'United States',
    notes: 'Renewed 2020',
  };

  it('creates a passport item with correct title', async () => {
    mockCreate.mockResolvedValue({ title: "Sarah Merriman's Passport" });
    const { createPassportItem } = await import('../../lib/1password');
    const result = await createPassportItem('vault-1', baseParams);
    expect(result.title).toBe("Sarah Merriman's Passport");
  });

  it('passes vaultId and Identity category', async () => {
    mockCreate.mockResolvedValue({});
    const { createPassportItem } = await import('../../lib/1password');
    await createPassportItem('vault-1', baseParams);
    const call = mockCreate.mock.calls[0][0];
    expect(call.vaultId).toBe('vault-1');
    expect(call.category).toBe('Identity');
  });

  it('includes sojourns and passport tags', async () => {
    mockCreate.mockResolvedValue({});
    const { createPassportItem } = await import('../../lib/1password');
    await createPassportItem('vault-1', baseParams);
    const call = mockCreate.mock.calls[0][0];
    expect(call.tags).toContain('sojourns');
    expect(call.tags).toContain('passport');
  });

  it('stores passport number as Concealed', async () => {
    mockCreate.mockResolvedValue({});
    const { createPassportItem } = await import('../../lib/1password');
    await createPassportItem('vault-1', baseParams);
    const fields = mockCreate.mock.calls[0][0].fields;
    const numberField = fields.find((f: any) => f.id === 'passport_number');
    expect(numberField.fieldType).toBe('Concealed');
  });

  it('includes all 8 passport fields', async () => {
    mockCreate.mockResolvedValue({});
    const { createPassportItem } = await import('../../lib/1password');
    await createPassportItem('vault-1', baseParams);
    const fields = mockCreate.mock.calls[0][0].fields;
    const ids = fields.map((f: any) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'given_names',
        'surname',
        'passport_number',
        'nationality',
        'date_of_birth',
        'issue_date',
        'expiry_date',
        'issuing_country',
      ]),
    );
  });
});
