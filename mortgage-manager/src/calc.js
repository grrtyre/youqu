// 房贷计算核心模块
// 包含：等额本息、等额本金、组合贷款、提前还款、月供明细
// 全部为纯函数，方便单元测试

'use strict';

function round(v, n = 2) {
  const f = Math.pow(10, n);
  return Math.round((v + Number.EPSILON) * f) / f;
}

function annualToMonthlyRate(annualRate) {
  return annualRate / 100 / 12;
}

/**
 * 等额本息：计算月供
 * 公式：M = P * r * (1+r)^n / ((1+r)^n - 1)
 */
function equalInstallment(principal, annualRate, years) {
  const n = years * 12;
  const r = annualToMonthlyRate(annualRate);
  let monthlyPayment;
  if (r === 0) {
    monthlyPayment = principal / n;
  } else {
    const pow = Math.pow(1 + r, n);
    monthlyPayment = (principal * r * pow) / (pow - 1);
  }
  monthlyPayment = round(monthlyPayment);

  const schedule = [];
  let remaining = principal;
  let totalInterest = 0;
  for (let i = 1; i <= n; i++) {
    const interestPart = round(remaining * r);
    const principalPart = round(monthlyPayment - interestPart);
    remaining = round(remaining - principalPart);
    totalInterest += interestPart;
    schedule.push({
      period: i,
      monthlyPayment: monthlyPayment,
      principalPart: principalPart,
      interestPart: interestPart,
      remaining: Math.max(remaining, 0)
    });
  }
  if (schedule.length > 0) {
    const last = schedule[schedule.length - 1];
    if (last.remaining > 0 && last.remaining < 5) {
      last.principalPart = round(last.principalPart + last.remaining);
      last.remaining = 0;
    }
  }
  totalInterest = round(totalInterest);
  const totalPayment = round(principal + totalInterest);
  return { monthlyPayment, totalInterest, totalPayment, schedule };
}

/**
 * 等额本金：每月本金固定，利息递减
 */
function equalPrincipal(principal, annualRate, years) {
  const n = years * 12;
  const r = annualToMonthlyRate(annualRate);
  const monthlyPrincipal = round(principal / n);
  const schedule = [];
  let remaining = principal;
  let totalInterest = 0;
  let firstPayment = 0;
  let lastPayment = 0;
  for (let i = 1; i <= n; i++) {
    const interestPart = round(remaining * r);
    const payment = round(monthlyPrincipal + interestPart);
    remaining = round(remaining - monthlyPrincipal);
    totalInterest += interestPart;
    if (i === 1) firstPayment = payment;
    if (i === n) lastPayment = payment;
    schedule.push({
      period: i,
      monthlyPayment: payment,
      principalPart: monthlyPrincipal,
      interestPart: interestPart,
      remaining: Math.max(remaining, 0)
    });
  }
  totalInterest = round(totalInterest);
  const totalPayment = round(principal + totalInterest);
  const monthlyDecrement = round(monthlyPrincipal * r);
  return {
    monthlyPaymentFirst: firstPayment,
    monthlyPaymentLast: lastPayment,
    monthlyDecrement,
    totalInterest,
    totalPayment,
    schedule
  };
}

/**
 * 组合贷款：商业贷款 + 公积金贷款
 */
function combinedLoan(params) {
  const {
    commercialPrincipal, commercialRate,
    fundPrincipal, fundRate, years, method
  } = params;

  const commercial = method === 'equalInstallment'
    ? equalInstallment(commercialPrincipal, commercialRate, years)
    : equalPrincipal(commercialPrincipal, commercialRate, years);
  const fund = method === 'equalInstallment'
    ? equalInstallment(fundPrincipal, fundRate, years)
    : equalPrincipal(fundPrincipal, fundRate, years);

  const schedule = [];
  const len = Math.max(commercial.schedule.length, fund.schedule.length);
  for (let i = 0; i < len; i++) {
    const c = commercial.schedule[i] || { monthlyPayment: 0, principalPart: 0, interestPart: 0, remaining: 0 };
    const f = fund.schedule[i] || { monthlyPayment: 0, principalPart: 0, interestPart: 0, remaining: 0 };
    schedule.push({
      period: i + 1,
      monthlyPayment: round(c.monthlyPayment + f.monthlyPayment),
      principalPart: round(c.principalPart + f.principalPart),
      interestPart: round(c.interestPart + f.interestPart),
      remaining: round(c.remaining + f.remaining)
    });
  }

  return {
    commercial, fund, schedule,
    totalInterest: round(commercial.totalInterest + fund.totalInterest),
    totalPayment: round(commercial.totalPayment + fund.totalPayment),
    totalPrincipal: round(commercialPrincipal + fundPrincipal)
  };
}

/**
 * 提前还款测算
 */
function prepayment(params) {
  const { originalSchedule, prepayMonth, prepayAmount, annualRate, mode } = params;
  const r = annualToMonthlyRate(annualRate);

  const beforePrepay = originalSchedule[prepayMonth - 1];
  if (!beforePrepay) throw new Error('提前还款期次超出原还款期限');
  const remainingBeforePrepay = beforePrepay.remaining;

  if (prepayAmount >= remainingBeforePrepay) {
    const savedInterest = originalSchedule
      .slice(prepayMonth).reduce((s, x) => s + x.interestPart, 0);
    const newSchedule = originalSchedule.slice(0, prepayMonth).map(x => ({ ...x }));
    newSchedule[newSchedule.length - 1].remaining = 0;
    newSchedule[newSchedule.length - 1].prepaid = round(Math.min(prepayAmount, remainingBeforePrepay));
    return {
      newSchedule, savedInterest: round(savedInterest),
      newTermMonths: prepayMonth, newMonthlyPayment: 0, paidOff: true
    };
  }

  const remainingAfter = round(remainingBeforePrepay - prepayAmount);
  let newSchedule = originalSchedule.slice(0, prepayMonth).map(x => ({ ...x }));
  newSchedule[newSchedule.length - 1].prepaid = prepayAmount;
  newSchedule[newSchedule.length - 1].remainingAfterPrepay = remainingAfter;

  let savedInterest = 0;

  if (mode === 'reduceTerm') {
    const originalMonthly = originalSchedule[prepayMonth].monthlyPayment;
    let remaining = remainingAfter;
    let i = prepayMonth + 1;
    while (remaining > 0.01 && i < originalSchedule.length + 600) {
      const interestPart = round(remaining * r);
      let principalPart = round(originalMonthly - interestPart);
      if (principalPart >= remaining) {
        principalPart = round(remaining);
        const payment = round(principalPart + interestPart);
        newSchedule.push({
          period: i, monthlyPayment: payment, principalPart,
          interestPart, remaining: 0
        });
        remaining = 0;
      } else {
        remaining = round(remaining - principalPart);
        newSchedule.push({
          period: i, monthlyPayment: originalMonthly, principalPart,
          interestPart, remaining: Math.max(remaining, 0)
        });
      }
      i++;
    }
    const originalRemainingInterest = originalSchedule
      .slice(prepayMonth).reduce((s, x) => s + x.interestPart, 0);
    const newRemainingInterest = newSchedule
      .slice(prepayMonth).reduce((s, x) => s + x.interestPart, 0);
    savedInterest = round(originalRemainingInterest - newRemainingInterest);
    return {
      newSchedule, savedInterest,
      newTermMonths: newSchedule.length,
      newMonthlyPayment: originalMonthly, paidOff: false
    };
  } else {
    const remainingTerm = originalSchedule.length - prepayMonth;
    let monthlyPayment;
    if (r === 0) {
      monthlyPayment = remainingAfter / remainingTerm;
    } else {
      const pow = Math.pow(1 + r, remainingTerm);
      monthlyPayment = (remainingAfter * r * pow) / (pow - 1);
    }
    monthlyPayment = round(monthlyPayment);
    let remaining = remainingAfter;
    for (let i = 1; i <= remainingTerm; i++) {
      const interestPart = round(remaining * r);
      let principalPart = round(monthlyPayment - interestPart);
      if (i === remainingTerm) {
        principalPart = round(remaining);
        const payment = round(principalPart + interestPart);
        newSchedule.push({
          period: prepayMonth + i, monthlyPayment: payment,
          principalPart, interestPart, remaining: 0
        });
      } else {
        remaining = round(remaining - principalPart);
        newSchedule.push({
          period: prepayMonth + i, monthlyPayment: monthlyPayment,
          principalPart, interestPart, remaining: Math.max(remaining, 0)
        });
      }
    }
    const originalRemainingInterest = originalSchedule
      .slice(prepayMonth).reduce((s, x) => s + x.interestPart, 0);
    const newRemainingInterest = newSchedule
      .slice(prepayMonth).reduce((s, x) => s + x.interestPart, 0);
    savedInterest = round(originalRemainingInterest - newRemainingInterest);
    return {
      newSchedule, savedInterest,
      newTermMonths: originalSchedule.length,
      newMonthlyPayment: monthlyPayment, paidOff: false
    };
  }
}

function scheduleToCSV(schedule) {
  const header = '期次,月供(元),本金(元),利息(元),剩余本金(元)\n';
  const rows = schedule
    .map(s => `${s.period},${s.monthlyPayment},${s.principalPart},${s.interestPart},${s.remaining}`)
    .join('\n');
  return '\uFEFF' + header + rows;
}

function lprRate(lpr, spread) {
  return round(lpr + spread / 100, 4);
}

function estimateFundLimit(monthlyContribution, years, multiplier = 15) {
  return round(monthlyContribution * 12 * years * multiplier / 10000) * 10000;
}

const _exports = {
  round, annualToMonthlyRate,
  equalInstallment, equalPrincipal,
  combinedLoan, prepayment,
  scheduleToCSV, lprRate, estimateFundLimit
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}
if (typeof window !== 'undefined') {
  window.calc = _exports;
}
