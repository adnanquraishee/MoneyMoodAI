// Real Indian market cases, one or two per metric. Each shows the number
// pointing one way and the outcome going the other — or the number being
// right for a reason the beginner would not have expected.
//
// Figures are rounded and approximate on purpose: these are documented,
// widely-reported episodes, told to make a point about how to read a metric,
// not to be a price record. Phrasing stays at "roughly" and "around".

export interface RealityStory {
    /** Glossary term this story teaches. */
    term: string;
    company: string;
    period: string;
    /** What the number said at the time. */
    theNumber: string;
    /** What people concluded from it. */
    theBelief: string;
    /** What actually happened. */
    whatHappened: string;
    /** The one thing to take away. */
    lesson: string;
}

export const REALITY_STORIES: RealityStory[] = [
    {
        term: 'pe',
        company: 'Yes Bank',
        period: '2018 – 2020',
        theNumber: 'P/E looked modest for a fast-growing private bank, and it was among the cheapest of its peers.',
        theBelief: '"A growing bank at a cheap price — the market is being irrational."',
        whatHappened: 'The loan book held far more bad debt than reported. From its 2018 high the stock fell over 95%, was placed under RBI moratorium in March 2020, and shareholders were diluted in the rescue.',
        lesson: 'A P/E that is low compared with peers is a question, not an answer. The market often knows what the ratio cannot show.',
    },
    {
        term: 'pe',
        company: 'Titan',
        period: '2015 – 2024',
        theNumber: 'P/E around 40× — roughly double the market — for a jewellery and watch retailer.',
        theBelief: '"Far too expensive for a shop. Wait for it to come down."',
        whatHappened: 'Earnings compounded for a decade as organised jewellery took share from local jewellers. The share price rose roughly eight to ten times. The P/E never became "cheap".',
        lesson: 'A high P/E is a bill for future growth. When the growth is real and durable, the bill gets paid — and waiting for cheap means waiting forever.',
    },
    {
        term: 'debt_to_equity',
        company: 'DHFL',
        period: '2018 – 2019',
        theNumber: 'Heavy borrowing, as is normal for a housing lender — the stock looked cheap on P/E and P/B and paid a dividend.',
        theBelief: '"Lenders always carry debt. It is cheap and it pays me to wait."',
        whatHappened: 'When short-term funding dried up after the IL&FS default in late 2018, DHFL could not roll over its borrowings. It missed payments in 2019 and the stock fell roughly 95% from its 2018 high.',
        lesson: 'Leverage is fine until the day lenders stop lending. A cheap, indebted company is cheap because of that day, not despite it.',
    },
    {
        term: 'dividend_yield',
        company: 'ITC',
        period: '2017 – 2023',
        theNumber: 'Dividend yield above 4%, one of the highest among large companies, on a P/E well below the market.',
        theBelief: '"Cheap, safe, and it pays me 4% a year. What is there to lose?"',
        whatHappened: 'Nothing was lost — but for about five years the share price went sideways to down while the market roughly doubled. Then, from 2022, it re-rated sharply and more than doubled.',
        lesson: 'Cheap can stay cheap for years. The dividend was real and the eventual re-rating was real, but the price of both was patience most investors did not have.',
    },
    {
        term: 'earnings_growth',
        company: 'Zomato',
        period: '2021 – 2024',
        theNumber: 'No P/E at all — the company was loss-making at listing. Revenue growth was rapid.',
        theBelief: 'At listing: "Growth is all that matters." A year later: "No profits, no value."',
        whatHappened: 'Listed in July 2021 around ₹76, jumped on debut, then fell to roughly ₹40 in 2022 as loss-making companies were re-priced globally. It later turned profitable and rose above ₹250 by 2024.',
        lesson: 'When a company has no earnings, valuation ratios go silent and sentiment does the pricing. That cuts both ways, violently, and on a schedule nobody can time.',
    },
    {
        term: 'roe',
        company: 'Vakrangee',
        period: '2017 – 2018',
        theNumber: 'Reported returns on equity and growth that looked exceptional for years; the stock had risen many times over.',
        theBelief: '"The numbers are outstanding. This is a compounding machine."',
        whatHappened: 'Concerns over the reliability of its accounts surfaced in early 2018 and its auditor resigned. The stock fell roughly 90% within months.',
        lesson: 'A ratio is only as honest as the accounts it is built from. Exceptional numbers deserve more scrutiny, not less.',
    },
    {
        term: 'momentum',
        company: 'Adani Group stocks',
        period: '2020 – 2023',
        theNumber: 'Among the strongest momentum in the market — several group stocks rose more than ten times in two years.',
        theBelief: '"The trend is unstoppable. Buy what is going up."',
        whatHappened: 'In January 2023 a short-seller report triggered a collapse; some group stocks fell 60–80% within weeks. Several later recovered a large part of the fall.',
        lesson: 'Momentum works on average across many stocks. On any single stock it can reverse in days, and the reversal arrives fastest where the run was steepest.',
    },
    {
        term: 'beta',
        company: 'Hindustan Unilever vs. a mid-cap basket',
        period: 'March 2020',
        theNumber: 'HUL, a low-beta consumer staple, versus high-beta mid-caps.',
        theBelief: '"Low beta is boring. High beta is where the money is."',
        whatHappened: 'In the March 2020 crash the NIFTY fell about 38% from its peak. HUL fell far less; many high-beta mid-caps fell 50–60%. In the rebound, the mid-caps rose far more.',
        lesson: 'Beta is not good or bad — it is a choice about how large your swings will be, in both directions. The question is which swing you can actually live through.',
    },
];

/** Stories for one metric, in the order they should be read. */
export function storiesFor(term: string): RealityStory[] {
    return REALITY_STORIES.filter(s => s.term === term);
}
