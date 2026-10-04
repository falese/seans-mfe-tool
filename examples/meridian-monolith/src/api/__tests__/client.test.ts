import http, { getBerths, getPayroll } from '../client';

jest.mock('axios', () => {
  const instance = { get: jest.fn() };
  return { __esModule: true, default: { create: () => instance } };
});

const get = (http as unknown as { get: jest.Mock }).get;

describe('api client', () => {
  beforeEach(() => get.mockReset());

  it('camelCases harbormaster rows', async () => {
    get.mockResolvedValue({ data: [{ berth_id: 'b1', current_docking_id: 4021 }] });
    const berths = await getBerths();
    expect(get).toHaveBeenCalledWith('/api/harbormaster/berths', { params: undefined });
    expect(berths[0]).toEqual({ berthId: 'b1', currentDockingId: 4021 });
  });

  it('returns payroll', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    const payroll = await getPayroll();
    expect(payroll).toEqual([]);
  });
});
