/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Reference dataset
import { regions, products, customers, orders, inventory } from './src/data/salesData';
import { User } from './src/types';

const app = express();
const PORT = 3000;

// Body parsing configurations
app.use(express.json());

// -------------------------------------------------------------------------
// 1. JWT / Simple Authentication APIs
// -------------------------------------------------------------------------
const mockUsers: User[] = [
  { id: 'U001', username: 'admin', email: 'admin@corporate.com', role: 'Admin' },
  { id: 'U002', username: 'analyst', email: 'analyst@corporate.com', role: 'User' }
];

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = mockUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (user && password === 'admin') {
    // Return mock token representation and user details
    return res.json({
      token: `mock-jwt-token-header.${Buffer.from(JSON.stringify(user)).toString('base64')}.signature`,
      user
    });
  } else if (user && password === 'analyst') {
    return res.json({
      token: `mock-jwt-token-header.${Buffer.from(JSON.stringify(user)).toString('base64')}.signature`,
      user
    });
  }
  
  return res.status(401).json({ error: 'Invalid username or password. (Hint: Use user "admin" or "analyst" with password "admin")' });
});

// -------------------------------------------------------------------------
// 2. Dashboard KPIs & Analytical APIs
// -------------------------------------------------------------------------

// Helper to safely aggregate values
const sum = (array: number[]) => array.reduce((a, b) => a + b, 0);

// Get high level KPIs
app.get('/api/dashboard/kpis', (req, res) => {
  try {
    const totalRevenue = sum(orders.map(o => o.revenue));
    const totalProfit = sum(orders.map(o => o.profit));
    const totalOrders = orders.length;
    const totalCustomers = customers.length;
    
    // Profit margin = Profit / Revenue
    const profitMargin = (totalProfit / totalRevenue) * 100;
    
    // Revenue Growth calculation: Compare 2025 vs 2026 Monthly Average (YoY Equivalent)
    const rev2025 = sum(orders.filter(o => o.orderDate.startsWith('2025')).map(o => o.revenue));
    const countMonths2025 = 12;
    const rev2026 = sum(orders.filter(o => o.orderDate.startsWith('2026')).map(o => o.revenue));
    const countMonths2026 = 5; // Jan to May 2026
    
    const monthlyAverage2025 = rev2025 / countMonths2025;
    const monthlyAverage2026 = rev2026 / countMonths2026;
    
    const revenueGrowth = ((monthlyAverage2026 - monthlyAverage2025) / monthlyAverage2025) * 100;

    res.json({
      totalRevenue: Math.round(totalRevenue),
      totalProfit: Math.round(totalProfit),
      totalOrders,
      totalCustomers,
      revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
      profitMargin: parseFloat(profitMargin.toFixed(1))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to compile KPIs', details: err.message });
  }
});

// Sales Trend Line charts: Monthly, Quarterly, and Daily trends
app.get('/api/dashboard/sales-analytics', (req, res) => {
  try {
    // 1. Expand Monthly Trend
    const monthlyMap: { [key: string]: { revenue: number, profit: number, orders: number } } = {};
    orders.forEach(o => {
      // o.orderDate is "YYYY-MM-DD" -> parse "YYYY-MM"
      const ym = o.orderDate.slice(0, 7);
      if (!monthlyMap[ym]) {
        monthlyMap[ym] = { revenue: 0, profit: 0, orders: 0 };
      }
      monthlyMap[ym].revenue += o.revenue;
      monthlyMap[ym].profit += o.profit;
      monthlyMap[ym].orders += 1;
    });
    
    const monthlyTrend = Object.keys(monthlyMap).sort().map(key => ({
      period: key,
      revenue: Math.round(monthlyMap[key].revenue),
      profit: Math.round(monthlyMap[key].profit),
      orders: monthlyMap[key].orders
    }));

    // 2. Expand Quarterly Trend
    const quarterlyMap: { [key: string]: { revenue: number, profit: number, orders: number } } = {};
    orders.forEach(o => {
      const year = o.orderDate.slice(0, 4);
      const month = parseInt(o.orderDate.slice(5, 7));
      let q = 'Q1';
      if (month >= 10) q = 'Q4';
      else if (month >= 7) q = 'Q3';
      else if (month >= 4) q = 'Q2';
      
      const yq = `${year}-${q}`;
      if (!quarterlyMap[yq]) {
        quarterlyMap[yq] = { revenue: 0, profit: 0, orders: 0 };
      }
      quarterlyMap[yq].revenue += o.revenue;
      quarterlyMap[yq].profit += o.profit;
      quarterlyMap[yq].orders += 1;
    });

    const quarterlyTrend = Object.keys(quarterlyMap).sort().map(key => ({
      period: key,
      revenue: Math.round(quarterlyMap[key].revenue),
      profit: Math.round(quarterlyMap[key].profit),
      orders: quarterlyMap[key].orders
    }));

    // 3. Daily sales trend (aggregate the last 30 active days in DB)
    const dailyMap: { [key: string]: { revenue: number, profit: number, orders: number } } = {};
    orders.forEach(o => {
      const date = o.orderDate;
      if (!dailyMap[date]) {
        dailyMap[date] = { revenue: 0, profit: 0, orders: 0 };
      }
      dailyMap[date].revenue += o.revenue;
      dailyMap[date].profit += o.profit;
      dailyMap[date].orders += 1;
    });

    const dailyTrend = Object.keys(dailyMap).sort().reverse().slice(0, 30).reverse().map(key => ({
      period: key,
      revenue: Math.round(dailyMap[key].revenue),
      profit: Math.round(dailyMap[key].profit),
      orders: dailyMap[key].orders
    }));

    res.json({ monthlyTrend, quarterlyTrend, dailyTrend });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Regional metrics & Geo distribution
app.get('/api/dashboard/regions', (req, res) => {
  try {
    const totalRev = sum(orders.map(o => o.revenue));
    const regionalData = regions.map(reg => {
      const regOrders = orders.filter(o => o.regionId === reg.regionId);
      const rev = sum(regOrders.map(o => o.revenue));
      const prof = sum(regOrders.map(o => o.profit));
      
      // Calculate growth as percentage of change between 2025 and 2026 averages
      const rev25 = sum(regOrders.filter(o => o.orderDate.startsWith('2025')).map(o => o.revenue)) / 12;
      const rev26 = sum(regOrders.filter(o => o.orderDate.startsWith('2026')).map(o => o.revenue)) / 5;
      const growth = rev25 > 0 ? ((rev26 - rev25) / rev25) * 100 : 0;

      return {
        regionId: reg.regionId,
        regionName: reg.name,
        country: reg.country,
        manager: reg.manager,
        latitude: reg.latitude,
        longitude: reg.longitude,
        revenue: Math.round(rev),
        profit: Math.round(prof),
        growth: parseFloat(growth.toFixed(1)),
        percentage: parseFloat(((rev / totalRev) * 100).toFixed(1))
      };
    });

    res.json(regionalData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Product-wise Performance and category analysis
app.get('/api/dashboard/products', (req, res) => {
  try {
    // Generate records of revenue and profit for each product
    const productStats = products.map(prod => {
      const prodOrders = orders.filter(o => o.productId === prod.productId);
      const rev = sum(prodOrders.map(o => o.revenue));
      const prof = sum(prodOrders.map(o => o.profit));
      const sold = sum(prodOrders.map(o => o.quantity));
      const margin = rev > 0 ? (prof / rev) * 100 : 0;
      
      return {
        productId: prod.productId,
        productName: prod.name,
        category: prod.category,
        revenue: Math.round(rev),
        profit: Math.round(prof),
        quantitySold: sold,
        margin: parseFloat(margin.toFixed(1))
      };
    });
    
    // Sort top 10 products by revenue descending
    const topProducts = [...productStats].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    
    // Sort bottom 10 products by revenue ascending (excluding products with 0 revenue)
    const bottomProducts = [...productStats]
      .filter(p => p.revenue > 0)
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 10);

    // Categories breakdown
    const categoryMap: { [key: string]: { revenue: number, profit: number, quantity: number } } = {};
    productStats.forEach(p => {
      if (!categoryMap[p.category]) {
        categoryMap[p.category] = { revenue: 0, profit: 0, quantity: 0 };
      }
      categoryMap[p.category].revenue += p.revenue;
      categoryMap[p.category].profit += p.profit;
      categoryMap[p.category].quantity += p.quantitySold;
    });

    const categoryPerformance = Object.keys(categoryMap).map(catKey => {
      const rev = categoryMap[catKey].revenue;
      const prof = categoryMap[catKey].profit;
      return {
        category: catKey,
        revenue: Math.round(rev),
        profit: Math.round(prof),
        quantity: categoryMap[catKey].quantity,
        margin: rev > 0 ? parseFloat(((prof / rev) * 100).toFixed(1)) : 0
      };
    });

    res.json({ topProducts, bottomProducts, categoryPerformance, allProducts: productStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Customer demographics & metrics
app.get('/api/dashboard/customers', (req, res) => {
  try {
    // Process customer metrics
    const customerStats = customers.map(cust => {
      const custOrders = orders.filter(o => o.customerId === cust.customerId);
      const rev = sum(custOrders.map(o => o.revenue));
      const prof = sum(custOrders.map(o => o.profit));
      const ordersCount = custOrders.length;
      
      return {
        customerId: cust.customerId,
        name: cust.name,
        email: cust.email,
        segment: cust.segment,
        revenue: Math.round(rev),
        profit: Math.round(prof),
        ordersCount,
        clv: cust.clv,
        joinDate: cust.joinDate
      };
    });

    const topCustomers = [...customerStats].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Segment contributions
    const segmentMap: { [key: string]: { count: number, revenue: number, clvSum: number } } = {};
    customerStats.forEach(c => {
      if (!segmentMap[c.segment]) {
        segmentMap[c.segment] = { count: 0, revenue: 0, clvSum: 0 };
      }
      segmentMap[c.segment].count += 1;
      segmentMap[c.segment].revenue += c.revenue;
      segmentMap[c.segment].clvSum += c.clv;
    });

    const customerSegmentation = Object.keys(segmentMap).map(segKey => {
      const info = segmentMap[segKey];
      return {
        segment: segKey,
        count: info.count,
        revenue: Math.round(info.revenue),
        clvAvg: Math.round(info.clvSum / info.count)
      };
    });

    res.json({ topCustomers, customerSegmentation, allCustomers: customerStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory stock warnings & seasonal trends
app.get('/api/dashboard/inventory', (req, res) => {
  try {
    res.json(inventory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// 3. Relational SQL Explorer Sandbox Engine
// -------------------------------------------------------------------------
// Parses simple SQL SELECT queries against the mock tables safely in JS!
// This allows true SQL workspace execution for the analyst!
app.post('/api/db/query', (req, res) => {
  const { sql } = req.body;
  if (!sql) {
    return res.status(400).json({ error: 'SQL query text is required' });
  }

  try {
    const rawSql = sql.trim().replace(/\s+/g, ' ');
    const lower = rawSql.toLowerCase();

    if (!lower.startsWith('select')) {
      throw new Error('Only SELECT queries are supported in the analytical sandbox for database security.');
    }

    // Determine target table
    let tableData: any[] = [];
    let nameOfTable = '';

    if (lower.includes('from orders')) {
      tableData = orders;
      nameOfTable = 'orders';
    } else if (lower.includes('from customers')) {
      tableData = customers;
      nameOfTable = 'customers';
    } else if (lower.includes('from products')) {
      tableData = products;
      nameOfTable = 'products';
    } else if (lower.includes('from regions')) {
      tableData = regions;
      nameOfTable = 'regions';
    } else if (lower.includes('from inventory')) {
      tableData = inventory;
      nameOfTable = 'inventory';
    } else {
      throw new Error('Table not found! Supported tables: "orders", "customers", "products", "regions", "inventory"');
    }

    // Basic Column Filter parsing
    // SELECT column1, column2 FROM...
    const selectPart = rawSql.substring(6, lower.indexOf('from')).trim();
    const columnsToKeep = selectPart.split(',').map((c: string) => c.trim().replace(/`/g, ''));
    const isSelectStar = selectPart === '*';

    // Basic Limit parsing
    let dataResults = [...tableData];
    const limitIndex = lower.indexOf('limit');
    if (limitIndex !== -1) {
      const limitVal = parseInt(lower.substring(limitIndex + 5).trim());
      if (!isNaN(limitVal)) {
        dataResults = dataResults.slice(0, limitVal);
      }
    }

    // Simple Where Condition filter (e.g. "where category = 'electronics'")
    const whereIndex = lower.indexOf('where');
    if (whereIndex !== -1) {
      const afterWhere = lower.substring(whereIndex + 5, limitIndex !== -1 ? limitIndex : undefined).trim();
      
      // Parse direct equality strings, numbers, category, status
      // match format: column = 'value'
      const match = afterWhere.match(/([a-zA-Z_0-9]+)\s*=\s*['"]?([^'"]+)['"]?/);
      if (match) {
        const field = match[1];
        // map db values to javascript names if different
        const keyMap: any = {
          order_id: 'orderId',
          customer_id: 'customerId',
          product_id: 'productId',
          region_id: 'regionId',
          order_date: 'orderDate',
          retail_price: 'retailPrice',
          clv: 'clv',
          segment: 'segment',
          seasonal_demand: 'seasonalDemand',
          stock: 'stock'
        };
        
        const jsField = keyMap[field] || field;
        const val = match[2];
        
        dataResults = dataResults.filter(row => {
          const rowVal = String(row[jsField] || '').toLowerCase();
          return rowVal === val.toLowerCase();
        });
      }
    }

    // Filter properties
    const finalRows = dataResults.map(row => {
      if (isSelectStar) return row;
      const filtered: any = {};
      columnsToKeep.forEach(col => {
        // match columns to fields (camelCase equivalents)
        const keyMap: any = {
          order_id: 'orderId',
          customer_id: 'customerId',
          product_id: 'productId',
          region_id: 'regionId',
          order_date: 'orderDate',
          quantity: 'quantity',
          discount: 'discount',
          revenue: 'revenue',
          profit: 'profit',
          name: 'name',
          email: 'email',
          segment: 'segment',
          clv: 'clv',
          join_date: 'joinDate',
          category: 'category',
          retail_price: 'retailPrice',
          cost: 'cost',
          stock: 'stock',
          manager: 'manager',
          country: 'country'
        };
        const mappedCol = keyMap[col] || col;
        if (row[mappedCol] !== undefined) {
          filtered[col] = row[mappedCol];
        } else {
          filtered[col] = row[col] || null;
        }
      });
      return filtered;
    });

    res.json({
      query: rawSql,
      rowCount: finalRows.length,
      columns: finalRows.length > 0 ? Object.keys(finalRows[0]) : ['*'],
      rows: finalRows
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// 4. Advanced Reporting API Downloads
// -------------------------------------------------------------------------

// Download active CRM orders in raw CSV representation
app.get('/api/reports/download-csv', (req, res) => {
  try {
    const headers = ['OrderID', 'CustomerID', 'ProductID', 'RegionID', 'OrderDate', 'Quantity', 'Discount', 'Revenue', 'Profit'];
    const csvRows = [headers.join(',')];
    
    orders.forEach(o => {
      csvRows.push([
        o.orderId,
        o.customerId,
        o.productId,
        o.regionId,
        o.orderDate,
        o.quantity,
        o.discount,
        o.revenue,
        o.profit
      ].join(','));
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_performance_report.csv');
    res.status(200).send(csvRows.join('\n'));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to construct CSV stream', details: err.message });
  }
});

// Stream back the dynamic MySQL INSERT files complete with 520 inserts!
app.get('/api/reports/download-sql', (req, res) => {
  try {
    const sqlStatements: string[] = [
      '-- ==========================================================',
      '-- DYNAMIC GENERATED SALES DATABASE DUMP',
      `-- Generated on: ${new Date().toISOString()}`,
      `-- Total Relational Insertions: ${orders.length + customers.length + products.length + regions.length}`,
      '-- ==========================================================\n',
      'USE sales_dashboard_db;\n',
      '-- Disable constraints temporarily to accelerate insert processes',
      'SET FOREIGN_KEY_CHECKS = 0;\n'
    ];

    // Regions DML
    sqlStatements.push('-- Inserting Regions --');
    regions.forEach(reg => {
      sqlStatements.push(`INSERT INTO regions (region_id, name, country, manager, latitude, longitude) VALUES ('${reg.regionId}', '${reg.name.replace(/'/g, "''")}', '${reg.country.replace(/'/g, "''")}', '${reg.manager.replace(/'/g, "''")}', ${reg.latitude}, ${reg.longitude});`);
    });
    sqlStatements.push('');

    // Products DML
    sqlStatements.push('-- Inserting Products --');
    products.forEach(p => {
      sqlStatements.push(`INSERT INTO products (product_id, name, category, retail_price, cost, stock, seasonal_demand) VALUES ('${p.productId}', '${p.name.replace(/'/g, "''")}', '${p.category}', ${p.retailPrice}, ${p.cost}, ${p.stock}, '${p.seasonalDemand}');`);
    });
    sqlStatements.push('');

    // Customers DML
    sqlStatements.push('-- Inserting Customers --');
    customers.forEach(c => {
      sqlStatements.push(`INSERT INTO customers (customer_id, name, email, segment, region_id, clv, join_date) VALUES ('${c.customerId}', '${c.name.replace(/'/g, "''")}', '${c.email}', '${c.segment}', '${c.regionId}', ${c.clv}, '${c.joinDate}');`);
    });
    sqlStatements.push('');

    // Active high-density orders (All 520 entries dynamically outputted on-the-fly)
    sqlStatements.push(`-- Inserting Orders (Total: ${orders.length} transactions) --`);
    orders.forEach(o => {
      sqlStatements.push(`INSERT INTO orders (order_id, customer_id, product_id, region_id, order_date, quantity, discount, revenue, profit) VALUES ('${o.orderId}', '${o.customerId}', '${o.productId}', '${o.regionId}', '${o.orderDate}', ${o.quantity}, ${o.discount}, ${o.revenue}, ${o.profit});`);
    });
    sqlStatements.push('');

    // Re-enable constraints
    sqlStatements.push('SET FOREIGN_KEY_CHECKS = 1;');

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename=complete_sales_database_source.sql');
    res.status(200).send(sqlStatements.join('\n'));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to construct SQL dump', details: err.message });
  }
});

// -------------------------------------------------------------------------
// 5. Google Gemini AI Insights Route
// -------------------------------------------------------------------------
// Utilizing the recommended SDK syntax from SKILL.md
let googleGenAiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!googleGenAiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not defined. Please navigate to Settings > Secrets inside the AI Studio code editor to provision your credentials.');
    }
    // Initialize lazily to prevent startup node crash
    googleGenAiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return googleGenAiClient;
}

app.post('/api/ai/insights', async (req, res) => {
  const { customPrompt } = req.body;

  try {
    const ai = getGeminiClient();
    
    // Aggregate contextual summary statistics from our operational lists for the model
    const totalRev = sum(orders.map(o => o.revenue));
    const totalProf = sum(orders.map(o => o.profit));
    const ordersCount = orders.length;
    const categoryRev = products.reduce((acc: any, p) => {
      const rev = sum(orders.filter(o => o.productId === p.productId).map(o => o.revenue));
      acc[p.category] = (acc[p.category] || 0) + rev;
      return acc;
    }, {});

    const regionalSummary = regions.map(reg => {
      const regOrders = orders.filter(o => o.regionId === reg.regionId);
      const rev = sum(regOrders.map(o => o.revenue));
      return `${reg.name}: $${Math.round(rev).toLocaleString()}`;
    }).join(', ');

    const contextPrimer = `
     You are a Lead Data Analyst and Senior Business Intelligence Consultant.
     You have read the sales performance relational tables which has 520 records spanning Jan 2025 - May 2026.
     Strategic Corporate Overview:
     - Total Revenue: $${totalRev.toLocaleString()}
     - Total Net Profit: $${totalProf.toLocaleString()}
     - Profit Margin: ${((totalProf / totalRev) * 100).toFixed(1)}%
     - Transaction Volume: ${ordersCount} order rows.
     - Regional Revenue breakdown: ${regionalSummary}
     - Category contributions: ${JSON.stringify(categoryRev)}
     `;

    const modelPrompt = customPrompt ? 
      `User query: "${customPrompt}"\nUsing this context:\n${contextPrimer}` : 
      `Compile a quarterly executive sales review report. Identify the top performing region, detect Seasonal Demand indicators, perform dynamic forecasting of Q3 2026 revenues based on the current rates, and state three recommendations with DAX/SQL tips.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: modelPrompt,
      config: {
        systemInstruction: "You are an executive sales advisor. Format your outputs with elegant markdown including distinct clear headings, clean bullet points, tables where relevant, and use rich bold texts.",
        temperature: 0.7,
      }
    });

    const valText = response.text || "No insights generated.";
    res.json({ insights: valText });
  } catch (err: any) {
    console.error('Gemini insights error:', err.message);
    res.status(200).json({ 
      error: true,
      insights: `### AI Insights Service Alert
      
${err.message.includes('not defined') ? 
'**API Key Configuration Missing:** You have not configured the Google Gemini credential. Navigate to AI Studio UI **Settings > Secrets** to register your `GEMINI_API_KEY` environment variable. Once set, you will unlock full-scale AI forecasting, predictive analytics, anomalies detection and reporting recommendations.' : 
`An error occurred inside the server. Unable to compile AI context: ${err.message}`}`
    });
  }
});

// -------------------------------------------------------------------------
// 6. Vite Development & Production Ingress Pipelines
// -------------------------------------------------------------------------
async function initializeApp() {
  if (process.env.NODE_ENV !== 'production') {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Mount Vite dev middleware after our API routes to preserve API pathways
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), 'dist');
    // Serve build files from dist
    app.use(express.static(distPath));
    // SPA catch-all serves client-side routers
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sales Dashboard Router] Running full-stack on port ${PORT}`);
  });
}

initializeApp().catch(err => {
  console.error('[Startup failure]', err);
});
