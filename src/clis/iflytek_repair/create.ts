import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  createIflytekRepair,
  formatRepairResult,
  normalizeRepairTemplate,
} from './utils.js';

export const createRepairCommand = cli({
  site: 'iflytek_repair',
  name: 'create',
  description: 'Create a repair request from the iFlytek internal portal',
  domain: 'itsmsdp.iflytek.com',
  strategy: Strategy.UI,
  browser: true,
  args: [
    { name: 'template', required: true, help: 'Repair template: it, finance, property' },
    { name: 'location', required: true, help: 'Current location shown in the repair request' },
    { name: 'phone', required: true, help: 'Contact phone number' },
    { name: 'title', required: true, help: 'Repair request title' },
    { name: 'description', required: true, help: 'Repair request description' },
    { name: 'category', help: 'Required repair category, when the selected template asks for one' },
    { name: 'subcategory', help: 'Required repair subcategory, when the selected template asks for one' },
  ],
  columns: ['Status', 'Template', 'Title', 'Location', 'Phone', 'RequestId'],
  func: async (page, kwargs) => {
    const result = await createIflytekRepair(page, {
      template: normalizeRepairTemplate(String(kwargs.template)),
      location: String(kwargs.location),
      phone: String(kwargs.phone),
      title: String(kwargs.title),
      description: String(kwargs.description),
      category: kwargs.category ? String(kwargs.category) : undefined,
      subcategory: kwargs.subcategory ? String(kwargs.subcategory) : undefined,
    });
    return formatRepairResult(result);
  },
});
