import {
  LICENSES,
  evaluateCheck,
  requiredAcknowledgements,
  sellableState,
  todayInVietnam,
  type CheckInput,
} from './licenses';

const TODAY = '2026-11-23';

const check = (change: Partial<CheckInput>): CheckInput => ({
  acknowledgements: ['seen_on_source', 'attribution'],
  basis: 'license',
  creatorName: 'Tác giả',
  evidenceKey: 'private/license-evidence/u1/a.png',
  licenseCode: 'cc_by',
  ...change,
});

describe('evaluateCheck', () => {
  it('allows CC BY with the creator credited and a screenshot', () => {
    expect(evaluateCheck(check({}), TODAY)).toEqual({
      ok: true,
      result: {
        required: ['seen_on_source', 'attribution'],
        verdict: 'allowed',
      },
    });
  });

  it.each([
    'cc_by_nc',
    'cc_by_nc_sa',
    'cc_by_nc_nd',
    'standard_digital',
    'other',
  ])('records %s as blocked, without needing a screenshot', (licenseCode) => {
    const outcome = evaluateCheck(
      check({
        acknowledgements: ['seen_on_source'],
        evidenceKey: '',
        licenseCode,
      }),
      TODAY,
    );
    expect(outcome).toMatchObject({ ok: true, result: { verdict: 'blocked' } });
  });

  it('asks for every condition of the licence', () => {
    const outcome = evaluateCheck(
      check({
        acknowledgements: ['seen_on_source', 'attribution'],
        licenseCode: 'cc_by_nd',
      }),
      TODAY,
    );
    expect(outcome).toMatchObject({ ok: false });
    expect(!outcome.ok && outcome.message).toContain('Chỉ in đúng mẫu gốc');
  });

  it('marks no-derivatives licences as limited', () => {
    const outcome = evaluateCheck(
      check({
        acknowledgements: ['seen_on_source', 'attribution', 'no_modification'],
        licenseCode: 'cc_by_nd',
      }),
      TODAY,
    );
    expect(outcome).toMatchObject({ ok: true, result: { verdict: 'limited' } });
  });

  it('needs a screenshot and the creator for an allowed licence', () => {
    expect(evaluateCheck(check({ evidenceKey: '' }), TODAY)).toMatchObject({
      ok: false,
    });
    expect(evaluateCheck(check({ creatorName: ' ' }), TODAY)).toMatchObject({
      ok: false,
    });
  });

  it('refuses a licence it does not know', () => {
    expect(evaluateCheck(check({ licenseCode: 'mit' }), TODAY)).toMatchObject({
      ok: false,
    });
  });

  it('lets a valid membership cover a personal-use licence', () => {
    const membership = check({
      acknowledgements: ['seen_on_source', 'membership_active'],
      basis: 'membership',
      licenseCode: 'standard_digital',
      membershipUntil: '2026-12-31',
    });
    expect(evaluateCheck(membership, TODAY)).toMatchObject({
      ok: true,
      result: { verdict: 'allowed' },
    });
    expect(
      evaluateCheck({ ...membership, membershipUntil: '2026-11-22' }, TODAY),
    ).toMatchObject({ ok: false });
    expect(
      evaluateCheck({ ...membership, membershipUntil: null }, TODAY),
    ).toMatchObject({
      ok: false,
    });
  });

  it('needs a note saying how the creator gave permission', () => {
    const permission = check({
      acknowledgements: ['seen_on_source', 'permission_written'],
      basis: 'permission',
      licenseCode: 'cc_by_nc',
      note: '',
    });
    expect(evaluateCheck(permission, TODAY)).toMatchObject({ ok: false });
    expect(
      evaluateCheck({ ...permission, note: 'Email tác giả 20/11/2026' }, TODAY),
    ).toMatchObject({ ok: true, result: { verdict: 'allowed' } });
  });
});

describe('licence list', () => {
  it('blocks every non-commercial licence', () => {
    for (const item of LICENSES.filter((license) =>
      license.code.includes('_nc'),
    )) {
      expect(item.verdict).toBe('blocked');
    }
  });

  it('always asks the person to have seen the licence', () => {
    for (const item of LICENSES) {
      expect(requiredAcknowledgements('license', item)[0]).toBe(
        'seen_on_source',
      );
    }
  });
});

describe('sellableState', () => {
  const now = new Date('2026-11-23T05:00:00Z');
  const base = {
    basis: 'license' as const,
    checkedAt: new Date('2026-11-01T00:00:00Z'),
    membershipUntil: null,
    verdict: 'allowed' as const,
  };

  it('sells an allowed model checked recently', () => {
    expect(sellableState(base, now)).toEqual({
      reason: '',
      recheckDue: false,
      sellable: true,
    });
  });

  it('flags an old check but keeps selling', () => {
    const old = { ...base, checkedAt: new Date('2026-07-01T00:00:00Z') };
    expect(sellableState(old, now)).toMatchObject({
      recheckDue: true,
      sellable: true,
    });
  });

  it('stops selling when the membership has run out', () => {
    expect(
      sellableState(
        { ...base, basis: 'membership', membershipUntil: '2026-11-22' },
        now,
      ),
    ).toMatchObject({ recheckDue: true, sellable: false });
  });

  it('never sells a blocked one', () => {
    expect(sellableState({ ...base, verdict: 'blocked' }, now).sellable).toBe(
      false,
    );
  });
});

describe('todayInVietnam', () => {
  it('turns the day at midnight in Vietnam', () => {
    expect(todayInVietnam(new Date('2026-11-22T17:30:00Z'))).toBe('2026-11-23');
  });
});
