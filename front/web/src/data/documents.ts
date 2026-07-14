import type { DocItem } from '../types'

// Mock library of generated documents (no backend). Replace with an API call
// once the backend is live: GET /api/documents with the JWT from authHeader().
export function seedDocuments(): DocItem[] {
  return [
    { id: 'p1', type: 'ppt', title: 'Series A Investor Pitch', category: 'Startup Pitch', tags: ['fundraising', 'deck'], updated: '2h ago',
      slides: [
        { title: 'AI that builds your deck', bullets: ['Turn a prompt into a polished presentation', 'Editable PPTX in minutes'] },
        { title: 'The problem', bullets: ['Slide-making is slow and manual', 'Generic templates, weak story'] },
        { title: 'Our solution', bullets: ['Prompt to structured outline', 'AI design engine styles every slide'] },
        { title: 'Market', bullets: ['$10B+ presentation tooling', 'Growing AI adoption'] },
        { title: 'The ask', bullets: ['Raising $2M seed', '12-month runway to scale'] },
      ] },
    { id: 'p2', type: 'ppt', title: 'Q2 Business Review', category: 'Business Report', tags: ['report', 'internal'], updated: 'yesterday',
      slides: [
        { title: 'Q2 at a glance', bullets: ['Revenue +18% QoQ', 'Churn down to 2.1%'] },
        { title: 'Highlights', bullets: ['Launched 3 features', 'Closed 5 enterprise deals'] },
        { title: 'Next quarter', bullets: ['Expand to EU', 'Hire 4 engineers'] },
      ] },
    { id: 'k1', type: 'kurs', title: 'Renewable Energy in Central Asia', category: 'Economics', tags: ['kurs ishi', 'references'], updated: '3d ago',
      sections: [
        { heading: 'Introduction', body: 'This course project examines the adoption of renewable energy across Central Asia, its drivers, and barriers.' },
        { heading: 'Chapter 1. Background', body: 'An overview of the regional energy mix and the current policy landscape.' },
        { heading: 'Chapter 2. Analysis', body: 'A comparative analysis of solar and wind potential across the region.' },
        { heading: 'Conclusion', body: 'Summary of the key findings and policy recommendations.' },
        { heading: 'References', body: '1. IEA (2024). World Energy Outlook.\n2. IRENA (2023). Renewable Capacity Statistics.' },
      ] },
    { id: 'k2', type: 'kurs', title: 'Database Indexing Strategies', category: 'Computer Science', tags: ['kurs ishi', 'lab'], updated: '1w ago',
      sections: [
        { heading: 'Introduction', body: 'Indexing is central to query performance in relational databases.' },
        { heading: 'Chapter 1. B-Trees', body: 'How B-tree indexes work and when they are the right choice.' },
        { heading: 'Conclusion', body: 'Trade-offs between read and write performance.' },
      ] },
    { id: 'm1', type: 'mustaqil', title: 'Database Normalization with Examples', category: 'Databases', tags: ['mustaqil ish', '8 pages'], updated: '5h ago',
      sections: [
        { heading: 'Topic overview', body: 'Normalization organizes data to reduce redundancy and improve integrity.' },
        { heading: '1NF, 2NF, 3NF', body: 'Worked examples moving a table through the normal forms.' },
        { heading: 'Summary', body: 'When to normalize, and when to denormalize for performance.' },
      ] },
    { id: 'm2', type: 'mustaqil', title: 'Essay: The Future of Remote Work', category: 'Essay', tags: ['mustaqil ish', 'essay'], updated: '2w ago',
      sections: [
        { heading: 'Introduction', body: 'Remote work reshaped how organizations operate after 2020.' },
        { heading: 'Body', body: 'Benefits, challenges, and the rise of hybrid models.' },
        { heading: 'Conclusion', body: 'Remote work is durable, but still evolving.' },
      ] },
  ]
}
