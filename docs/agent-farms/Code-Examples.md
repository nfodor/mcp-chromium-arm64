# 💻 Code Examples: Ready-to-Use Agent Farm Implementations

#code #examples #templates #ready-to-use

## 🚀 Complete Agent Farm Setup

### 1. Farm Manager Class
```python
# farm_manager.py
import asyncio
import aiohttp
import json
from typing import List, Dict, Any
import logging

class AgentFarm:
    """Complete Pi Agent Farm Management"""
    
    def __init__(self, agents: List[str]):
        self.agents = agents
        self.current_agent = 0
        self.session = None
        self.logger = logging.getLogger(__name__)
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    def get_next_agent(self) -> str:
        """Round-robin agent selection"""
        agent = self.agents[self.current_agent]
        self.current_agent = (self.current_agent + 1) % len(self.agents)
        return agent
        
    async def execute_task(self, task: Dict[str, Any], retries: int = 3) -> Dict[str, Any]:
        """Execute task with automatic failover"""
        last_error = None
        
        for attempt in range(retries):
            agent = self.get_next_agent()
            
            try:
                async with self.session.post(
                    f"http://{agent}:3000/browse",
                    json=task,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        self.logger.info(f"Task completed on {agent}")
                        return result
                    else:
                        self.logger.warning(f"Agent {agent} returned {response.status}")
                        
            except Exception as e:
                last_error = e
                self.logger.error(f"Agent {agent} failed: {e}")
                
        raise Exception(f"All agents failed. Last error: {last_error}")
        
    async def parallel_execute(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Execute multiple tasks in parallel"""
        semaphore = asyncio.Semaphore(len(self.agents))
        
        async def bounded_task(task):
            async with semaphore:
                return await self.execute_task(task)
                
        results = await asyncio.gather(
            *[bounded_task(task) for task in tasks],
            return_exceptions=True
        )
        
        return results
        
    async def health_check(self) -> Dict[str, bool]:
        """Check health of all agents"""
        health_status = {}
        
        async def check_agent(agent):
            try:
                async with self.session.get(
                    f"http://{agent}:3000/health",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    return agent, response.status == 200
            except:
                return agent, False
                
        results = await asyncio.gather(
            *[check_agent(agent) for agent in self.agents],
            return_exceptions=True
        )
        
        for result in results:
            if isinstance(result, tuple):
                agent, status = result
                health_status[agent] = status
            else:
                # Exception occurred
                health_status['unknown'] = False
                
        return health_status

# Usage example
async def main():
    agents = [
        "pi-agent-01.local",
        "pi-agent-02.local", 
        "pi-agent-03.local"
    ]
    
    async with AgentFarm(agents) as farm:
        # Health check
        health = await farm.health_check()
        print(f"Agent health: {health}")
        
        # Single task
        result = await farm.execute_task({
            "action": "navigate",
            "url": "https://example.com"
        })
        print(f"Navigation result: {result}")
        
        # Parallel tasks
        tasks = [
            {"action": "navigate", "url": f"https://example.com/page{i}"}
            for i in range(1, 11)
        ]
        
        results = await farm.parallel_execute(tasks)
        print(f"Processed {len(results)} tasks")

if __name__ == "__main__":
    asyncio.run(main())
```

### 2. Express.js Agent Server
```javascript
// agent-server.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class AgentServer {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.browserPath = path.join(__dirname, 'arm64_browser.py');
        this.activeTasks = new Map();
    }
    
    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use((req, res, next) => {
            req.taskId = crypto.randomUUID();
            console.log(`[${req.taskId}] ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                node: process.env.HOSTNAME || 'pi-agent',
                activeTasks: this.activeTasks.size,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        });
        
        // Main browsing endpoint
        this.app.post('/browse', async (req, res) => {
            try {
                const result = await this.executeBrowserTask(req.taskId, req.body);
                res.json({ success: true, result, taskId: req.taskId });
            } catch (error) {
                console.error(`[${req.taskId}] Error:`, error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    taskId: req.taskId
                });
            }
        });
        
        // Batch processing
        this.app.post('/batch', async (req, res) => {
            const { tasks } = req.body;
            const results = [];
            
            for (const task of tasks) {
                try {
                    const result = await this.executeBrowserTask(req.taskId, task);
                    results.push({ success: true, result });
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }
            
            res.json({ results, taskId: req.taskId });
        });
        
        // Task status
        this.app.get('/task/:taskId', (req, res) => {
            const task = this.activeTasks.get(req.params.taskId);
            if (!task) {
                res.status(404).json({ error: 'Task not found' });
            } else {
                res.json(task);
            }
        });
    }
    
    async executeBrowserTask(taskId, taskData) {
        const { action, url, selector, value, script } = taskData;
        
        // Track active task
        this.activeTasks.set(taskId, {
            action,
            url,
            startTime: Date.now(),
            status: 'running'
        });
        
        try {
            let command = `python3 -c "import sys; sys.path.append('${__dirname}'); import arm64_browser; `;
            
            switch (action) {
                case 'navigate':
                    command += `print(arm64_browser.navigate('${url}'))"`;
                    break;
                    
                case 'screenshot':
                    const filename = value || `screenshot_${taskId}.png`;
                    command += `print(arm64_browser.screenshot('${filename}'))"`;
                    break;
                    
                case 'click':
                    command += `print(arm64_browser.click('${selector}'))"`;
                    break;
                    
                case 'fill':
                    command += `print(arm64_browser.fill('${selector}', '${value}'))"`;
                    break;
                    
                case 'evaluate':
                    command += `print(arm64_browser.evaluate('${script}'))"`;
                    break;
                    
                case 'get_content':
                    const type = value || 'text';
                    command += `print(arm64_browser.get_content('${type}'))"`;
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
            
            const result = await this.execCommand(command);
            
            // Update task status
            this.activeTasks.set(taskId, {
                ...this.activeTasks.get(taskId),
                status: 'completed',
                endTime: Date.now(),
                result
            });
            
            // Clean up completed tasks after 5 minutes
            setTimeout(() => {
                this.activeTasks.delete(taskId);
            }, 5 * 60 * 1000);
            
            return result;
            
        } catch (error) {
            // Update task status
            this.activeTasks.set(taskId, {
                ...this.activeTasks.get(taskId),
                status: 'failed',
                endTime: Date.now(),
                error: error.message
            });
            
            throw error;
        }
    }
    
    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }
    
    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`Agent server running on port ${port}`);
            console.log(`Node: ${process.env.HOSTNAME || 'pi-agent'}`);
        });
    }
}

// Start server
const server = new AgentServer();
server.start(process.env.PORT || 3000);

module.exports = AgentServer;
```

### 3. Web Scraping Pipeline
```python
# scraping_pipeline.py
import asyncio
import json
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import pandas as pd

@dataclass
class ScrapingTask:
    url: str
    selectors: Dict[str, str]
    name: str
    timeout: int = 30

class ScrapingPipeline:
    """High-performance web scraping using Pi agent farm"""
    
    def __init__(self, farm: AgentFarm):
        self.farm = farm
        self.results = []
        
    async def scrape_sites(self, tasks: List[ScrapingTask]) -> pd.DataFrame:
        """Scrape multiple sites and return DataFrame"""
        
        # Convert to agent tasks
        agent_tasks = []
        for task in tasks:
            agent_tasks.append({
                "action": "navigate",
                "url": task.url
            })
            
        # Navigate to all sites
        navigation_results = await self.farm.parallel_execute(agent_tasks)
        
        # Extract data from each site
        extraction_tasks = []
        for i, task in enumerate(tasks):
            if isinstance(navigation_results[i], dict) and navigation_results[i].get('success'):
                for field, selector in task.selectors.items():
                    extraction_tasks.append({
                        "action": "evaluate",
                        "script": f"document.querySelector('{selector}')?.textContent || ''",
                        "_metadata": {
                            "site": task.name,
                            "field": field,
                            "url": task.url
                        }
                    })
                    
        # Execute extractions
        extraction_results = await self.farm.parallel_execute(extraction_tasks)
        
        # Process results into DataFrame
        return self._process_results(extraction_results)
        
    def _process_results(self, results: List[Dict[str, Any]]) -> pd.DataFrame:
        """Convert raw results to structured DataFrame"""
        processed = []
        
        for i, result in enumerate(results):
            if isinstance(result, dict) and 'result' in result:
                metadata = result.get('_metadata', {})
                processed.append({
                    'site': metadata.get('site', 'unknown'),
                    'field': metadata.get('field', 'unknown'),
                    'value': result['result'],
                    'url': metadata.get('url', '')
                })
                
        df = pd.DataFrame(processed)
        
        # Pivot to have one row per site
        if not df.empty:
            df_pivot = df.pivot_table(
                index=['site', 'url'],
                columns='field',
                values='value',
                aggfunc='first'
            ).reset_index()
            return df_pivot
            
        return pd.DataFrame()

# Usage example
async def scrape_ecommerce_sites():
    agents = ["pi-agent-01.local", "pi-agent-02.local"]
    
    tasks = [
        ScrapingTask(
            name="Amazon Product",
            url="https://amazon.com/dp/B08N5WRWNW",
            selectors={
                "title": "#productTitle",
                "price": ".a-price-whole",
                "rating": "[data-asin] .a-icon-alt"
            }
        ),
        ScrapingTask(
            name="eBay Product",
            url="https://ebay.com/itm/123456789",
            selectors={
                "title": "h1#x-title-label-lbl",
                "price": ".prc .num",
                "condition": ".u-flL .condText"
            }
        )
    ]
    
    async with AgentFarm(agents) as farm:
        pipeline = ScrapingPipeline(farm)
        results_df = await pipeline.scrape_sites(tasks)
        
        print(results_df)
        results_df.to_csv('scraping_results.csv', index=False)

if __name__ == "__main__":
    asyncio.run(scrape_ecommerce_sites())
```

### 4. SEO Monitoring System
```python
# seo_monitor.py
import asyncio
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Any
import schedule
import time

class SEOMonitor:
    """Automated SEO ranking monitor using Pi farm"""
    
    def __init__(self, farm: AgentFarm, db_path: str = "seo_data.db"):
        self.farm = farm
        self.db_path = db_path
        self.init_database()
        
    def init_database(self):
        """Initialize SQLite database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rankings (
                    id INTEGER PRIMARY KEY,
                    keyword TEXT,
                    search_engine TEXT,
                    position INTEGER,
                    url TEXT,
                    timestamp DATETIME,
                    domain TEXT
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS keywords (
                    id INTEGER PRIMARY KEY,
                    keyword TEXT UNIQUE,
                    target_domain TEXT,
                    active BOOLEAN DEFAULT 1
                )
            """)
            
    async def check_keyword_rankings(self, keywords: List[str], search_engine: str = "google"):
        """Check rankings for multiple keywords"""
        
        tasks = []
        for keyword in keywords:
            search_url = self._build_search_url(keyword, search_engine)
            tasks.append({
                "action": "navigate",
                "url": search_url,
                "_keyword": keyword
            })
            
        # Execute searches
        search_results = await self.farm.parallel_execute(tasks)
        
        # Extract rankings
        ranking_tasks = []
        for i, result in enumerate(search_results):
            if isinstance(result, dict) and result.get('success'):
                keyword = tasks[i]["_keyword"]
                ranking_tasks.append({
                    "action": "evaluate",
                    "script": """
                        Array.from(document.querySelectorAll('.g h3')).map((el, index) => ({
                            position: index + 1,
                            title: el.textContent,
                            url: el.closest('.g').querySelector('a')?.href || ''
                        }))
                    """,
                    "_keyword": keyword
                })
                
        ranking_results = await self.farm.parallel_execute(ranking_tasks)
        
        # Store results
        self._store_rankings(ranking_results, search_engine)
        
        return ranking_results
        
    def _build_search_url(self, keyword: str, search_engine: str) -> str:
        """Build search URL for different engines"""
        engines = {
            "google": f"https://google.com/search?q={keyword.replace(' ', '+')}&num=20",
            "bing": f"https://bing.com/search?q={keyword.replace(' ', '+')}&count=20",
            "duckduckgo": f"https://duckduckgo.com/?q={keyword.replace(' ', '+')}"
        }
        return engines.get(search_engine, engines["google"])
        
    def _store_rankings(self, results: List[Dict], search_engine: str):
        """Store ranking results in database"""
        timestamp = datetime.now()
        
        with sqlite3.connect(self.db_path) as conn:
            for result in results:
                if isinstance(result, dict) and 'result' in result:
                    keyword = result.get('_keyword')
                    rankings = json.loads(result['result'])
                    
                    for rank_data in rankings:
                        conn.execute("""
                            INSERT INTO rankings 
                            (keyword, search_engine, position, url, timestamp, domain)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            keyword,
                            search_engine,
                            rank_data['position'],
                            rank_data['url'],
                            timestamp,
                            self._extract_domain(rank_data['url'])
                        ))
                        
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc
        except:
            return ""
            
    def get_ranking_report(self, days: int = 7) -> pd.DataFrame:
        """Generate ranking report for last N days"""
        with sqlite3.connect(self.db_path) as conn:
            query = """
                SELECT keyword, search_engine, position, domain, timestamp
                FROM rankings
                WHERE timestamp >= datetime('now', '-{} days')
                ORDER BY keyword, timestamp
            """.format(days)
            
            return pd.read_sql_query(query, conn)
            
    def setup_scheduler(self, keywords: List[str], interval_hours: int = 6):
        """Setup automated monitoring schedule"""
        
        async def run_check():
            async with self.farm:
                await self.check_keyword_rankings(keywords)
                
        def job():
            asyncio.run(run_check())
            
        schedule.every(interval_hours).hours.do(job)
        
        print(f"SEO monitoring scheduled every {interval_hours} hours")
        print(f"Monitoring {len(keywords)} keywords")
        
        while True:
            schedule.run_pending()
            time.sleep(60)

# Usage example
async def main():
    agents = ["pi-agent-01.local", "pi-agent-02.local", "pi-agent-03.local"]
    
    keywords = [
        "raspberry pi automation",
        "browser automation arm64",
        "cheap web scraping",
        "claude code tutorial"
    ]
    
    async with AgentFarm(agents) as farm:
        monitor = SEOMonitor(farm)
        
        # One-time check
        results = await monitor.check_keyword_rankings(keywords)
        print(f"Checked {len(keywords)} keywords")
        
        # Generate report
        report = monitor.get_ranking_report(days=30)
        print(report.head())

if __name__ == "__main__":
    asyncio.run(main())
```

### 5. Load Testing Framework
```python
# load_tester.py
import asyncio
import time
from dataclasses import dataclass
from typing import List, Dict, Any
import statistics

@dataclass
class LoadTestConfig:
    target_url: str
    concurrent_users: int
    duration_seconds: int
    ramp_up_seconds: int = 0

class LoadTester:
    """Load testing using Pi agent farm"""
    
    def __init__(self, farm: AgentFarm):
        self.farm = farm
        self.results = []
        
    async def run_load_test(self, config: LoadTestConfig) -> Dict[str, Any]:
        """Execute load test"""
        print(f"Starting load test: {config.concurrent_users} users for {config.duration_seconds}s")
        
        start_time = time.time()
        self.results = []
        
        # Create user tasks
        user_tasks = []
        for user_id in range(config.concurrent_users):
            task = self._create_user_session(
                user_id, 
                config.target_url, 
                config.duration_seconds,
                config.ramp_up_seconds
            )
            user_tasks.append(task)
            
        # Run all user sessions
        await asyncio.gather(*user_tasks, return_exceptions=True)
        
        end_time = time.time()
        
        # Analyze results
        return self._analyze_results(start_time, end_time, config)
        
    async def _create_user_session(self, user_id: int, url: str, duration: int, ramp_up: int):
        """Simulate single user session"""
        
        # Ramp up delay
        if ramp_up > 0:
            delay = (user_id / len(self.farm.agents)) * ramp_up
            await asyncio.sleep(delay)
            
        session_start = time.time()
        requests_made = 0
        
        while time.time() - session_start < duration:
            request_start = time.time()
            
            try:
                result = await self.farm.execute_task({
                    "action": "navigate",
                    "url": url
                })
                
                request_end = time.time()
                response_time = request_end - request_start
                
                self.results.append({
                    "user_id": user_id,
                    "timestamp": request_start,
                    "response_time": response_time,
                    "success": True,
                    "status_code": 200  # Assuming success
                })
                
                requests_made += 1
                
            except Exception as e:
                request_end = time.time()
                response_time = request_end - request_start
                
                self.results.append({
                    "user_id": user_id,
                    "timestamp": request_start,
                    "response_time": response_time,
                    "success": False,
                    "error": str(e)
                })
                
            # Brief pause between requests
            await asyncio.sleep(0.1)
            
    def _analyze_results(self, start_time: float, end_time: float, config: LoadTestConfig) -> Dict[str, Any]:
        """Analyze load test results"""
        
        total_duration = end_time - start_time
        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if r['success'])
        failed_requests = total_requests - successful_requests
        
        response_times = [r['response_time'] for r in self.results if r['success']]
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            p95_response_time = sorted(response_times)[int(len(response_times) * 0.95)]
            min_response_time = min(response_times)
            max_response_time = max(response_times)
        else:
            avg_response_time = median_response_time = p95_response_time = 0
            min_response_time = max_response_time = 0
            
        throughput = successful_requests / total_duration if total_duration > 0 else 0
        error_rate = failed_requests / total_requests if total_requests > 0 else 0
        
        return {
            "config": config,
            "summary": {
                "total_duration": total_duration,
                "total_requests": total_requests,
                "successful_requests": successful_requests,
                "failed_requests": failed_requests,
                "throughput_rps": throughput,
                "error_rate": error_rate
            },
            "response_times": {
                "avg": avg_response_time,
                "median": median_response_time,
                "p95": p95_response_time,
                "min": min_response_time,
                "max": max_response_time
            },
            "raw_results": self.results
        }

# Usage example
async def main():
    agents = ["pi-agent-01.local", "pi-agent-02.local", "pi-agent-03.local"]
    
    config = LoadTestConfig(
        target_url="https://example.com",
        concurrent_users=10,
        duration_seconds=60,
        ramp_up_seconds=10
    )
    
    async with AgentFarm(agents) as farm:
        tester = LoadTester(farm)
        results = await tester.run_load_test(config)
        
        print(f"Load Test Results:")
        print(f"Total Requests: {results['summary']['total_requests']}")
        print(f"Success Rate: {(1 - results['summary']['error_rate']) * 100:.1f}%")
        print(f"Throughput: {results['summary']['throughput_rps']:.2f} RPS")
        print(f"Avg Response Time: {results['response_times']['avg']:.3f}s")
        print(f"95th Percentile: {results['response_times']['p95']:.3f}s")

if __name__ == "__main__":
    asyncio.run(main())
```

### 6. Docker Deployment
```dockerfile
# Dockerfile
FROM balenalib/raspberry-pi-node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium-browser \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Install Python dependencies
RUN pip3 install aiohttp pandas

# Create non-root user
RUN useradd -m -u 1001 agent
RUN chown -R agent:agent /app
USER agent

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["node", "agent-server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  pi-agent-01:
    build: .
    container_name: pi-agent-01
    hostname: pi-agent-01
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - HOSTNAME=pi-agent-01
    restart: unless-stopped
    
  pi-agent-02:
    build: .
    container_name: pi-agent-02
    hostname: pi-agent-02
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=production
      - HOSTNAME=pi-agent-02
    restart: unless-stopped
    
  pi-agent-03:
    build: .
    container_name: pi-agent-03
    hostname: pi-agent-03
    ports:
      - "3003:3000"
    environment:
      - NODE_ENV=production
      - HOSTNAME=pi-agent-03
    restart: unless-stopped
    
  load-balancer:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - pi-agent-01
      - pi-agent-02
      - pi-agent-03
    restart: unless-stopped
```

## 🚀 Quick Start Templates

### Minimal Farm (3 nodes)
```bash
#!/bin/bash
# setup-minimal-farm.sh

# Clone and setup on each Pi
for pi in pi-01 pi-02 pi-03; do
    ssh pi@$pi "
        git clone https://github.com/nfodor/claude-arm64-browser
        cd claude-arm64-browser
        npm install
        python3 -c 'import sys; sys.path.append(\".\"); import arm64_browser; print(\"✅ Ready!\")'
    "
done

echo "Minimal farm setup complete!"
```

### Production Farm (10+ nodes)
```bash
#!/bin/bash
# setup-production-farm.sh

# Use Ansible for production deployment
ansible-playbook -i production-inventory.yml deploy-farm.yml

# Setup monitoring
docker-compose -f monitoring/docker-compose.yml up -d

# Setup load balancer
ansible-playbook -i production-inventory.yml setup-lb.yml

echo "Production farm deployed!"
```

---

**Previous**: [[Architecture]] - Technical design
**Related**: [[Implementation-Guide]] | [[Use-Cases]]