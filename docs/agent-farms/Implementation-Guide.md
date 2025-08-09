# 🛠️ Implementation Guide: Building Your Pi Agent Farm

#implementation #setup #tutorial #step-by-step

## Prerequisites

- [ ] Raspberry Pi 5 (4GB minimum, 8GB recommended)
- [ ] Official Raspberry Pi power supply
- [ ] High-quality SD card (A2 rated, 32GB+)
- [ ] Network access (Ethernet recommended)
- [ ] Basic Linux knowledge

## 📋 Phase 1: Single Pi Setup

### Step 1: Prepare Raspberry Pi OS

```bash
# Download Raspberry Pi OS Lite (64-bit)
# Flash to SD card using Raspberry Pi Imager

# Enable SSH before first boot:
# Add empty 'ssh' file to boot partition

# Configure Wi-Fi (optional):
# Add wpa_supplicant.conf to boot partition
```

### Step 2: Initial Configuration

```bash
# SSH into your Pi
ssh pi@raspberrypi.local

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
  chromium-browser \
  nodejs \
  npm \
  git \
  python3-pip \
  htop \
  screen

# Set hostname
sudo hostnamectl set-hostname pi-agent-01
```

### Step 3: Install ARM64 Browser Automation

```bash
# Clone the repository
git clone https://github.com/nfodor/claude-arm64-browser
cd claude-arm64-browser

# Install Node dependencies
npm install

# Test browser automation
python3 -c "import sys; sys.path.append('.'); import arm64_browser; print('✅ Works!' if 'error' not in arm64_browser.navigate('https://example.com').lower() else '❌ Failed')"
```

### Step 4: Create Agent Service

```bash
# Create systemd service
sudo tee /etc/systemd/system/claude-agent.service << EOF
[Unit]
Description=Claude Browser Agent
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/claude-browser
ExecStart=/usr/bin/node /opt/claude-browser/agent-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable claude-agent
sudo systemctl start claude-agent
```

## 🚀 Phase 2: Multi-Pi Orchestration

### Setting Up Ansible Control

```bash
# On your main machine (not Pi)
pip install ansible

# Create inventory file
cat > pi-inventory.ini << EOF
[agents]
pi-agent-01 ansible_host=192.168.1.101
pi-agent-02 ansible_host=192.168.1.102
pi-agent-03 ansible_host=192.168.1.103

[all:vars]
ansible_user=pi
ansible_ssh_private_key_file=~/.ssh/id_rsa
EOF
```

### Ansible Playbook for Farm Deployment

```yaml
# deploy-agent-farm.yml
---
- hosts: agents
  become: yes
  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
        
    - name: Install required packages
      apt:
        name:
          - chromium-browser
          - nodejs
          - npm
          - git
          - python3-pip
        state: present
        
    - name: Clone ARM64 browser repo
      git:
        repo: https://github.com/nfodor/claude-arm64-browser
        dest: /opt/claude-browser
        version: main
      become_user: pi
      
    - name: Install npm dependencies
      npm:
        path: /opt/claude-browser
      become_user: pi
        
    - name: Copy agent service file
      copy:
        src: claude-agent.service
        dest: /etc/systemd/system/
        
    - name: Start and enable agent service
      systemd:
        name: claude-agent
        state: started
        enabled: yes
        daemon_reload: yes
```

### Deploy to All Pis

```bash
# Test connection
ansible -i pi-inventory.ini agents -m ping

# Deploy to all agents
ansible-playbook -i pi-inventory.ini deploy-agent-farm.yml
```

## 📡 Phase 3: Load Balancer Setup

### HAProxy Configuration

```bash
# On load balancer Pi or separate machine
sudo apt install haproxy

# Configure HAProxy
sudo tee /etc/haproxy/haproxy.cfg << EOF
global
    daemon
    maxconn 256

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend agent_farm
    bind *:80
    default_backend pi_agents

backend pi_agents
    balance roundrobin
    server pi-agent-01 192.168.1.101:3000 check
    server pi-agent-02 192.168.1.102:3000 check
    server pi-agent-03 192.168.1.103:3000 check
EOF

sudo systemctl restart haproxy
```

## 🎛️ Phase 4: Monitoring & Management

### Install Monitoring Stack

```bash
# Prometheus node exporter on each Pi
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-arm64.tar.gz
tar xvf node_exporter-1.6.1.linux-arm64.tar.gz
sudo cp node_exporter-1.6.1.linux-arm64/node_exporter /usr/local/bin/

# Create service
sudo tee /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now node_exporter
```

### Central Monitoring Dashboard

```yaml
# docker-compose.yml for monitoring stack
version: '3'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## 🔧 Phase 5: Agent Server Implementation

Create `agent-server.js`:

```javascript
// agent-server.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());

// Import browser automation
const browserPath = path.join(__dirname, 'arm64_browser.py');

app.post('/browse', async (req, res) => {
  const { url, action, selector, value } = req.body;
  
  let command = `python3 -c "import sys; sys.path.append('${__dirname}'); import arm64_browser; `;
  
  switch(action) {
    case 'navigate':
      command += `print(arm64_browser.navigate('${url}'))"`;
      break;
    case 'screenshot':
      command += `print(arm64_browser.screenshot('${value || 'screenshot.png'}')"`;
      break;
    case 'click':
      command += `print(arm64_browser.click('${selector}'))"`;
      break;
    case 'fill':
      command += `print(arm64_browser.fill('${selector}', '${value}'))"`;
      break;
  }
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      res.status(500).json({ error: stderr });
    } else {
      res.json({ result: stdout.trim() });
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', node: process.env.HOSTNAME });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Agent server running on port ${PORT}`);
});
```

## 🎯 Testing Your Farm

### Single Node Test
```bash
curl -X POST http://pi-agent-01:3000/browse \
  -H "Content-Type: application/json" \
  -d '{"action": "navigate", "url": "https://example.com"}'
```

### Load Balanced Test
```bash
# Test through load balancer
for i in {1..10}; do
  curl http://load-balancer/browse \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"action": "navigate", "url": "https://example.com"}'
done
```

## 📊 Scaling Considerations

| Nodes | Recommended RAM | Network | Use Case |
|-------|----------------|---------|----------|
| 1-5 | 4GB per Pi | 100Mbps | Development |
| 5-20 | 8GB per Pi | 1Gbps | Production |
| 20-50 | 8GB per Pi | 1Gbps + VLANs | Enterprise |
| 50+ | 8GB per Pi | 10Gbps backbone | Large Scale |

## 🔒 Security Hardening

```bash
# Firewall rules
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable

# Fail2ban for SSH protection
sudo apt install fail2ban

# Regular updates
sudo apt update && sudo apt upgrade -y
```

## 🚨 Troubleshooting

### Common Issues

**Browser won't start**
```bash
# Check Chromium
chromium-browser --version
# Reinstall if needed
sudo apt reinstall chromium-browser
```

**Network connectivity**
```bash
# Test agent connectivity
ansible -i pi-inventory.ini agents -m ping
```

**Service failures**
```bash
# Check service status
sudo systemctl status claude-agent
# View logs
sudo journalctl -u claude-agent -f
```

---

**Next**: [[Use-Cases]] - Real-world applications
**Related**: [[Architecture]] | [[Code-Examples]]