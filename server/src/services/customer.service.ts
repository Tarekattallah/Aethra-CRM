import { Customer } from '../models/Customer.js';
import { Lead } from '../models/Lead.js';

export async function resolveCustomer(input: {
  customerName: string; phone: string; phoneNormalized: string; country: string;
  whatsappNumber?: string; email?: string; companyName?: string;
  websiteUrl?: string; socialLinks?: string[]; position?: string;
}) {
  const { customerName, ...contact } = input;
  try {
    return await Customer.findOneAndUpdate(
      { phoneNormalized: input.phoneNormalized },
      { $setOnInsert: { name: customerName, ...contact } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    const customer = await Customer.findOne({ phoneNormalized: input.phoneNormalized });
    if (!customer) throw error;
    return customer;
  }
}

// Idempotent additive backfill: no changes to amounts, activities or old codes.
// Historical merged inquiries remain in their original activity timeline.
export async function backfillCustomerProfiles(): Promise<number> {
  let linked = 0;
  const cursor = Lead.find({ customerId: null }).sort({ createdAt: 1 }).cursor();
  for await (const lead of cursor) {
    const customer = await resolveCustomer({
      customerName: lead.customerName, phone: lead.phone,
      phoneNormalized: lead.phoneNormalized, country: lead.country,
      whatsappNumber: lead.whatsappNumber, email: lead.email,
      companyName: lead.companyName, websiteUrl: lead.websiteUrl,
      socialLinks: lead.socialLinks, position: lead.position
    });
    const result = await Lead.updateOne({ _id: lead._id, customerId: null }, {
      $set: { customerId: customer!._id }
    }, { timestamps: false });
    linked += result.modifiedCount;
  }
  return linked;
}
