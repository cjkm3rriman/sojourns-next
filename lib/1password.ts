/**
 * 1Password SDK service — server-side only.
 *
 * Never import this module in client components. All calls must go through
 * Next.js API Routes or Server Actions.
 *
 * Vault item schema
 * -----------------
 * Credit cards  → ItemCategory.CreditCard
 *   Section "Card Details"
 *     cardholder_name   Text
 *     card_number       CreditCardNumber  (stored encrypted)
 *     expiry            MonthYear
 *     cvv               Concealed         (stored encrypted)
 *     card_type         CreditCardType
 *   Section "Billing"
 *     billing_address   Text
 *   Notes field: free-text agent notes
 *
 * Passports → ItemCategory.Identity  (mapped to SecureNote until Identity
 *             field support is confirmed — see TODO below)
 *   Section "Passport Details"
 *     given_names       Text
 *     surname           Text
 *     passport_number   Concealed
 *     nationality       Text
 *     date_of_birth     Date
 *     issue_date        Date
 *     expiry_date       Date
 *     issuing_authority   Text
 *   Notes field: free-text agent notes
 *
 * Item title convention
 *   Cards:     "<ClientName>'s <CardType> <last4>"
 *   Passports: "Passport — <ClientName>"
 *
 * Tags
 *   Cards always tagged:     ["sojourns", "card"]
 *   Passports always tagged: ["sojourns", "passport"]
 */

import { createClient, ItemCategory, ItemFieldType } from '@1password/sdk';
import type { Client, Item, ItemCreateParams } from '@1password/sdk';

// ─── Client singleton ────────────────────────────────────────────────────────

let _client: Client | null = null;

export async function getOpClient(): Promise<Client> {
  if (_client) return _client;

  const token = process.env.ONEPASSWORD_SERVICE_ACCOUNT_TOKEN;
  if (!token) {
    throw new Error('ONEPASSWORD_SERVICE_ACCOUNT_TOKEN is not set');
  }

  _client = await createClient({
    auth: token,
    integrationName: 'Sojourns',
    integrationVersion: '1.0.0',
  });

  return _client;
}

// ─── Vault ID helper ─────────────────────────────────────────────────────────

export function getVaultId(): string {
  const vaultId = process.env.ONEPASSWORD_VAULT_ID;
  if (!vaultId) {
    throw new Error('ONEPASSWORD_VAULT_ID is not set');
  }
  return vaultId;
}

// ─── Generic item operations ─────────────────────────────────────────────────

export async function getItem(vaultId: string, itemId: string): Promise<Item> {
  const client = await getOpClient();
  return client.items.get(vaultId, itemId);
}

export async function updateItem(item: Item): Promise<Item> {
  const client = await getOpClient();
  return client.items.put(item);
}

export async function deleteItem(
  vaultId: string,
  itemId: string,
): Promise<void> {
  const client = await getOpClient();
  return client.items.delete(vaultId, itemId);
}

export async function listItems(
  vaultId: string,
): Promise<Awaited<ReturnType<Client['items']['list']>>> {
  const client = await getOpClient();
  return client.items.list(vaultId);
}

// ─── Credit card ─────────────────────────────────────────────────────────────

export interface CardItemParams {
  clientName: string;
  cardholderName: string;
  cardNumber: string;
  expiry: string; // MM/YYYY
  cvv: string;
  cardType?: string; // Visa, Mastercard, Amex, etc.
  billingAddress?: string;
  billingZip?: string;
  notes?: string;
}

export async function createCardItem(
  vaultId: string,
  params: CardItemParams,
): Promise<Item> {
  const client = await getOpClient();

  const last4 = params.cardNumber.replace(/\s/g, '').slice(-4);
  const displayType = params.cardType ?? 'Card';
  const title = `${params.cardholderName}'s ${displayType} ${last4}`;

  const hasBilling = !!(params.billingAddress || params.billingZip);

  const itemParams: ItemCreateParams = {
    title,
    category: ItemCategory.CreditCard,
    vaultId,
    tags: ['sojourns', 'card'],
    ...(hasBilling
      ? { sections: [{ id: 'sojourns_billing', title: 'Billing' }] }
      : {}),
    fields: [
      {
        id: 'cardholder_name',
        title: 'Cardholder Name',
        fieldType: ItemFieldType.Text,
        value: params.cardholderName,
      },
      {
        id: 'card_number',
        title: 'Card Number',
        fieldType: ItemFieldType.Concealed,
        value: params.cardNumber.replace(/\s/g, ''),
      },
      {
        id: 'expiry',
        title: 'Expiry Date',
        fieldType: ItemFieldType.MonthYear,
        value: params.expiry,
      },
      {
        id: 'cvv',
        title: 'CVV',
        fieldType: ItemFieldType.Concealed,
        value: params.cvv,
      },
      ...(params.cardType
        ? [
            {
              id: 'card_type',
              title: 'Card Type',
              fieldType: ItemFieldType.Text,
              value: params.cardType,
            },
          ]
        : []),
      ...(params.billingAddress
        ? [
            {
              id: 'billing_address',
              title: 'Billing Address',
              fieldType: ItemFieldType.Text,
              value: params.billingAddress,
              sectionId: 'sojourns_billing',
            },
          ]
        : []),
      ...(params.billingZip
        ? [
            {
              id: 'billing_zip',
              title: 'Billing ZIP',
              fieldType: ItemFieldType.Text,
              value: params.billingZip,
              sectionId: 'sojourns_billing',
            },
          ]
        : []),
    ],
    ...(params.notes ? { notes: params.notes } : {}),
  };

  return client.items.create(itemParams);
}

// ─── Passport ─────────────────────────────────────────────────────────────────

export interface PassportItemParams {
  clientName: string;
  givenNames: string;
  surname: string;
  passportNumber: string;
  nationality: string;
  placeOfBirth: string;
  dateOfBirth: string; // YYYY-MM-DD
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  issuingCountry: string;
  notes?: string;
}

export async function createPassportItem(
  vaultId: string,
  params: PassportItemParams,
): Promise<Item> {
  const client = await getOpClient();

  const title = `${params.clientName}'s Passport`;
  const passportSection = { id: 'passport_details', title: 'Passport Details' };

  const itemParams: ItemCreateParams = {
    title,
    category: ItemCategory.Identity,
    vaultId,
    tags: ['sojourns', 'passport'],
    sections: [passportSection],
    fields: [
      {
        id: 'given_names',
        title: 'Given Names',
        fieldType: ItemFieldType.Text,
        value: params.givenNames,
        sectionId: 'passport_details',
      },
      {
        id: 'surname',
        title: 'Surname',
        fieldType: ItemFieldType.Text,
        value: params.surname,
        sectionId: 'passport_details',
      },
      {
        id: 'passport_number',
        title: 'Passport Number',
        fieldType: ItemFieldType.Concealed,
        value: params.passportNumber,
        sectionId: 'passport_details',
      },
      {
        id: 'nationality',
        title: 'Nationality',
        fieldType: ItemFieldType.Text,
        value: params.nationality,
        sectionId: 'passport_details',
      },
      {
        id: 'place_of_birth',
        title: 'Place of Birth',
        fieldType: ItemFieldType.Text,
        value: params.placeOfBirth,
        sectionId: 'passport_details',
      },
      {
        id: 'date_of_birth',
        title: 'Date of Birth',
        fieldType: ItemFieldType.Date,
        value: params.dateOfBirth,
        sectionId: 'passport_details',
      },
      {
        id: 'issue_date',
        title: 'Issue Date',
        fieldType: ItemFieldType.Date,
        value: params.issueDate,
        sectionId: 'passport_details',
      },
      {
        id: 'expiry_date',
        title: 'Expiry Date',
        fieldType: ItemFieldType.Date,
        value: params.expiryDate,
        sectionId: 'passport_details',
      },
      {
        id: 'issuing_authority',
        title: 'Issuing Authority',
        fieldType: ItemFieldType.Text,
        value: params.issuingCountry,
        sectionId: 'passport_details',
      },
    ],
    notes: params.notes,
  };

  return client.items.create(itemParams);
}
