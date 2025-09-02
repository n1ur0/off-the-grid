"""
Security audit tools for Off the Grid platform
Provides comprehensive security scanning, vulnerability assessment, and compliance checking
"""

import re
import json
import asyncio
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict

import aiohttp
import aiofiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from logging.python_logging import logger, log_security_event

@dataclass
class SecurityFinding:
    """Represents a security finding"""
    severity: str  # critical, high, medium, low, info
    category: str  # e.g., "authentication", "input_validation", "configuration"
    title: str
    description: str
    location: str
    remediation: str
    cve_id: Optional[str] = None
    cvss_score: Optional[float] = None
    references: List[str] = None
    
    def __post_init__(self):
        if self.references is None:
            self.references = []

@dataclass
class AuditReport:
    """Security audit report"""
    timestamp: datetime
    scope: str
    findings: List[SecurityFinding]
    summary: Dict[str, int]
    recommendations: List[str]
    compliance_status: Dict[str, bool]

class SQLInjectionScanner:
    """SQL injection vulnerability scanner"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.test_payloads = [
            "' OR '1'='1",
            "' UNION SELECT 1,2,3--",
            "'; DROP TABLE users; --",
            "' AND 1=CONVERT(int, (SELECT @@version))--",
            "' OR SLEEP(5)--",
            "' OR pg_sleep(5)--",
            "1' AND extractvalue(1, concat(0x7e, (SELECT version()), 0x7e))--",
        ]
    
    async def scan_endpoints(self, base_url: str, endpoints: List[str]) -> List[SecurityFinding]:
        """Scan API endpoints for SQL injection vulnerabilities"""
        findings = []
        
        async with aiohttp.ClientSession() as session:
            for endpoint in endpoints:
                endpoint_findings = await self._scan_endpoint(session, base_url, endpoint)
                findings.extend(endpoint_findings)
        
        return findings
    
    async def _scan_endpoint(
        self, 
        session: aiohttp.ClientSession, 
        base_url: str, 
        endpoint: str
    ) -> List[SecurityFinding]:
        """Scan a single endpoint for SQL injection"""
        findings = []
        
        for payload in self.test_payloads:
            try:
                # Test GET parameters
                url = f"{base_url}{endpoint}?id={payload}"
                async with session.get(url, timeout=10) as response:
                    if await self._check_sql_error_patterns(response):
                        findings.append(SecurityFinding(
                            severity="critical",
                            category="input_validation",
                            title=f"SQL Injection in {endpoint}",
                            description=f"Endpoint {endpoint} is vulnerable to SQL injection via GET parameter",
                            location=f"{endpoint} (GET parameter)",
                            remediation="Use parameterized queries and input validation",
                            references=["https://owasp.org/www-project-top-ten/2017/A1_2017-Injection"]
                        ))
                        break
                
                # Test POST data
                data = {"id": payload, "search": payload}
                async with session.post(f"{base_url}{endpoint}", json=data, timeout=10) as response:
                    if await self._check_sql_error_patterns(response):
                        findings.append(SecurityFinding(
                            severity="critical",
                            category="input_validation",
                            title=f"SQL Injection in {endpoint}",
                            description=f"Endpoint {endpoint} is vulnerable to SQL injection via POST data",
                            location=f"{endpoint} (POST data)",
                            remediation="Use parameterized queries and input validation",
                            references=["https://owasp.org/www-project-top-ten/2017/A1_2017-Injection"]
                        ))
                        break
                        
            except asyncio.TimeoutError:
                # Potential time-based SQL injection
                if "SLEEP" in payload or "pg_sleep" in payload:
                    findings.append(SecurityFinding(
                        severity="high",
                        category="input_validation",
                        title=f"Potential Time-based SQL Injection in {endpoint}",
                        description=f"Endpoint {endpoint} may be vulnerable to time-based SQL injection",
                        location=f"{endpoint}",
                        remediation="Use parameterized queries and input validation"
                    ))
            except Exception as e:
                logger.error(f"Error scanning endpoint {endpoint}: {e}")
        
        return findings
    
    async def _check_sql_error_patterns(self, response: aiohttp.ClientResponse) -> bool:
        """Check response for SQL error patterns"""
        text = await response.text()
        error_patterns = [
            r"mysql_fetch_array\(\)",
            r"ORA-\d{5}",
            r"Microsoft.*ODBC.*SQL Server",
            r"PostgreSQL.*ERROR",
            r"Warning.*mysql_.*",
            r"valid MySQL result",
            r"MySqlClient\.",
            r"SQLite.*error",
            r"sqlite3\.",
            r"OLE DB.*error",
        ]
        
        for pattern in error_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        
        return False

class XSSScanner:
    """Cross-site scripting vulnerability scanner"""
    
    def __init__(self):
        self.xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "'\"><script>alert('XSS')</script>",
            "<iframe src='javascript:alert('XSS')'></iframe>",
            "<body onload=alert('XSS')>",
        ]
    
    async def scan_endpoints(self, base_url: str, endpoints: List[str]) -> List[SecurityFinding]:
        """Scan API endpoints for XSS vulnerabilities"""
        findings = []
        
        async with aiohttp.ClientSession() as session:
            for endpoint in endpoints:
                endpoint_findings = await self._scan_endpoint(session, base_url, endpoint)
                findings.extend(endpoint_findings)
        
        return findings
    
    async def _scan_endpoint(
        self, 
        session: aiohttp.ClientSession, 
        base_url: str, 
        endpoint: str
    ) -> List[SecurityFinding]:
        """Scan a single endpoint for XSS"""
        findings = []
        
        for payload in self.xss_payloads:
            try:
                # Test GET parameters
                url = f"{base_url}{endpoint}?q={payload}"
                async with session.get(url, timeout=10) as response:
                    text = await response.text()
                    if self._check_xss_reflection(payload, text):
                        findings.append(SecurityFinding(
                            severity="high",
                            category="input_validation",
                            title=f"Reflected XSS in {endpoint}",
                            description=f"Endpoint {endpoint} reflects user input without proper encoding",
                            location=f"{endpoint} (GET parameter)",
                            remediation="Implement proper output encoding and CSP headers",
                            references=["https://owasp.org/www-project-top-ten/2017/A7_2017-Cross-Site_Scripting_(XSS)"]
                        ))
                
                # Test POST data
                data = {"message": payload, "comment": payload}
                async with session.post(f"{base_url}{endpoint}", json=data, timeout=10) as response:
                    text = await response.text()
                    if self._check_xss_reflection(payload, text):
                        findings.append(SecurityFinding(
                            severity="high",
                            category="input_validation",
                            title=f"Reflected XSS in {endpoint}",
                            description=f"Endpoint {endpoint} reflects user input without proper encoding",
                            location=f"{endpoint} (POST data)",
                            remediation="Implement proper output encoding and CSP headers"
                        ))
                        
            except Exception as e:
                logger.error(f"Error scanning endpoint {endpoint} for XSS: {e}")
        
        return findings
    
    def _check_xss_reflection(self, payload: str, response_text: str) -> bool:
        """Check if XSS payload is reflected in response"""
        # Simple check for payload reflection
        return payload in response_text

class AuthenticationScanner:
    """Authentication and authorization vulnerability scanner"""
    
    async def scan_auth_endpoints(self, base_url: str) -> List[SecurityFinding]:
        """Scan authentication-related endpoints"""
        findings = []
        
        # Test common authentication bypasses
        findings.extend(await self._test_auth_bypass(base_url))
        
        # Test session management
        findings.extend(await self._test_session_management(base_url))
        
        # Test password policies
        findings.extend(await self._test_password_policies(base_url))
        
        return findings
    
    async def _test_auth_bypass(self, base_url: str) -> List[SecurityFinding]:
        """Test for authentication bypass vulnerabilities"""
        findings = []
        
        bypass_attempts = [
            {"username": "admin", "password": "admin"},
            {"username": "' OR '1'='1", "password": "password"},
            {"username": "admin'--", "password": ""},
        ]
        
        async with aiohttp.ClientSession() as session:
            for attempt in bypass_attempts:
                try:
                    async with session.post(
                        f"{base_url}/api/auth/login",
                        json=attempt,
                        timeout=10
                    ) as response:
                        if response.status == 200:
                            findings.append(SecurityFinding(
                                severity="critical",
                                category="authentication",
                                title="Authentication Bypass",
                                description=f"Authentication bypass possible with credentials: {attempt}",
                                location="/api/auth/login",
                                remediation="Implement proper authentication validation and rate limiting"
                            ))
                except Exception as e:
                    logger.error(f"Error testing auth bypass: {e}")
        
        return findings
    
    async def _test_session_management(self, base_url: str) -> List[SecurityFinding]:
        """Test session management security"""
        findings = []
        
        async with aiohttp.ClientSession() as session:
            try:
                # Test session fixation
                async with session.get(f"{base_url}/api/auth/session") as response:
                    if 'Set-Cookie' in response.headers:
                        cookies = response.headers['Set-Cookie']
                        if 'Secure' not in cookies:
                            findings.append(SecurityFinding(
                                severity="medium",
                                category="session_management",
                                title="Insecure Session Cookies",
                                description="Session cookies are not marked as Secure",
                                location="Session cookies",
                                remediation="Add Secure flag to session cookies"
                            ))
                        
                        if 'HttpOnly' not in cookies:
                            findings.append(SecurityFinding(
                                severity="medium",
                                category="session_management",
                                title="Session Cookies Missing HttpOnly",
                                description="Session cookies are not marked as HttpOnly",
                                location="Session cookies",
                                remediation="Add HttpOnly flag to session cookies"
                            ))
                            
            except Exception as e:
                logger.error(f"Error testing session management: {e}")
        
        return findings
    
    async def _test_password_policies(self, base_url: str) -> List[SecurityFinding]:
        """Test password policy enforcement"""
        findings = []
        
        weak_passwords = ["123456", "password", "admin", "test"]
        
        async with aiohttp.ClientSession() as session:
            for weak_password in weak_passwords:
                try:
                    register_data = {
                        "username": "testuser",
                        "email": "test@example.com",
                        "password": weak_password
                    }
                    
                    async with session.post(
                        f"{base_url}/api/auth/register",
                        json=register_data,
                        timeout=10
                    ) as response:
                        if response.status == 201:
                            findings.append(SecurityFinding(
                                severity="medium",
                                category="authentication",
                                title="Weak Password Policy",
                                description=f"System accepts weak passwords like '{weak_password}'",
                                location="/api/auth/register",
                                remediation="Implement strong password policy enforcement"
                            ))
                            break
                            
                except Exception as e:
                    logger.error(f"Error testing password policy: {e}")
        
        return findings

class ConfigurationScanner:
    """Security configuration scanner"""
    
    async def scan_security_headers(self, base_url: str) -> List[SecurityFinding]:
        """Scan for missing security headers"""
        findings = []
        
        required_headers = {
            "Strict-Transport-Security": "HSTS not implemented",
            "Content-Security-Policy": "CSP not implemented",
            "X-Content-Type-Options": "MIME type sniffing protection missing",
            "X-Frame-Options": "Clickjacking protection missing",
            "X-XSS-Protection": "XSS protection header missing",
            "Referrer-Policy": "Referrer policy not set"
        }
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(base_url, timeout=10) as response:
                    headers = response.headers
                    
                    for header, description in required_headers.items():
                        if header not in headers:
                            findings.append(SecurityFinding(
                                severity="medium",
                                category="configuration",
                                title=f"Missing Security Header: {header}",
                                description=description,
                                location="HTTP headers",
                                remediation=f"Add {header} header to all responses"
                            ))
                    
                    # Check for information disclosure
                    if "Server" in headers:
                        server_header = headers["Server"]
                        if any(tech in server_header.lower() for tech in ["apache", "nginx", "iis"]):
                            findings.append(SecurityFinding(
                                severity="low",
                                category="configuration",
                                title="Server Information Disclosure",
                                description=f"Server header reveals technology: {server_header}",
                                location="Server header",
                                remediation="Remove or modify Server header to hide technology stack"
                            ))
                            
            except Exception as e:
                logger.error(f"Error scanning security headers: {e}")
        
        return findings

class DependencyScanner:
    """Dependency vulnerability scanner"""
    
    async def scan_python_dependencies(self, requirements_file: str) -> List[SecurityFinding]:
        """Scan Python dependencies for known vulnerabilities"""
        findings = []
        
        try:
            # Use safety to scan dependencies
            result = subprocess.run(
                ["safety", "check", "-r", requirements_file, "--json"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                safety_results = json.loads(result.stdout)
                
                for vuln in safety_results:
                    findings.append(SecurityFinding(
                        severity="high" if vuln.get("severity", "medium") == "high" else "medium",
                        category="dependencies",
                        title=f"Vulnerable Dependency: {vuln['package_name']}",
                        description=vuln['vulnerability'],
                        location=f"{vuln['package_name']} {vuln['installed_version']}",
                        remediation=f"Update to version {vuln['safe_versions']}",
                        cve_id=vuln.get('cve'),
                        references=[vuln.get('more_info_url', '')]
                    ))
                    
        except subprocess.TimeoutExpired:
            logger.error("Dependency scan timed out")
        except Exception as e:
            logger.error(f"Error scanning Python dependencies: {e}")
        
        return findings
    
    async def scan_node_dependencies(self, package_file: str) -> List[SecurityFinding]:
        """Scan Node.js dependencies for known vulnerabilities"""
        findings = []
        
        try:
            # Use npm audit
            result = subprocess.run(
                ["npm", "audit", "--json", "--prefix", str(Path(package_file).parent)],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.stdout:
                audit_results = json.loads(result.stdout)
                
                for advisory_id, advisory in audit_results.get("advisories", {}).items():
                    severity = advisory.get("severity", "medium")
                    
                    findings.append(SecurityFinding(
                        severity=severity,
                        category="dependencies",
                        title=f"Vulnerable Node.js Dependency: {advisory['module_name']}",
                        description=advisory['title'],
                        location=f"{advisory['module_name']} via {advisory.get('findings', [{}])[0].get('paths', ['unknown'])[0]}",
                        remediation=advisory.get('recommendation', 'Update dependency'),
                        cve_id=advisory.get('cves', [None])[0] if advisory.get('cves') else None,
                        references=[advisory.get('url', '')]
                    ))
                    
        except subprocess.TimeoutExpired:
            logger.error("Node.js dependency scan timed out")
        except Exception as e:
            logger.error(f"Error scanning Node.js dependencies: {e}")
        
        return findings

class ComplianceChecker:
    """Security compliance checker"""
    
    def __init__(self):
        self.owasp_top10_checks = {
            "A01_Injection": self._check_injection_protection,
            "A02_Broken_Authentication": self._check_authentication,
            "A03_Sensitive_Data_Exposure": self._check_data_protection,
            "A04_XML_External_Entities": self._check_xxe_protection,
            "A05_Broken_Access_Control": self._check_access_control,
            "A06_Security_Misconfiguration": self._check_security_config,
            "A07_Cross_Site_Scripting": self._check_xss_protection,
            "A08_Insecure_Deserialization": self._check_deserialization,
            "A09_Known_Vulnerabilities": self._check_known_vulns,
            "A10_Insufficient_Logging": self._check_logging
        }
    
    async def check_owasp_top10_compliance(self, findings: List[SecurityFinding]) -> Dict[str, bool]:
        """Check OWASP Top 10 compliance"""
        compliance_status = {}
        
        for check_name, check_func in self.owasp_top10_checks.items():
            try:
                is_compliant = await check_func(findings)
                compliance_status[check_name] = is_compliant
            except Exception as e:
                logger.error(f"Error in compliance check {check_name}: {e}")
                compliance_status[check_name] = False
        
        return compliance_status
    
    async def _check_injection_protection(self, findings: List[SecurityFinding]) -> bool:
        """Check for injection protection"""
        injection_findings = [f for f in findings if "injection" in f.title.lower()]
        return len(injection_findings) == 0
    
    async def _check_authentication(self, findings: List[SecurityFinding]) -> bool:
        """Check authentication implementation"""
        auth_findings = [f for f in findings if f.category == "authentication"]
        critical_auth_findings = [f for f in auth_findings if f.severity == "critical"]
        return len(critical_auth_findings) == 0
    
    async def _check_data_protection(self, findings: List[SecurityFinding]) -> bool:
        """Check data protection measures"""
        # Check for HTTPS enforcement, encryption, etc.
        data_findings = [f for f in findings if "data" in f.title.lower() or "encryption" in f.title.lower()]
        return len(data_findings) == 0
    
    async def _check_xxe_protection(self, findings: List[SecurityFinding]) -> bool:
        """Check XXE protection"""
        xxe_findings = [f for f in findings if "xxe" in f.title.lower() or "xml" in f.title.lower()]
        return len(xxe_findings) == 0
    
    async def _check_access_control(self, findings: List[SecurityFinding]) -> bool:
        """Check access control implementation"""
        access_findings = [f for f in findings if "access" in f.title.lower() or "authorization" in f.title.lower()]
        return len(access_findings) == 0
    
    async def _check_security_config(self, findings: List[SecurityFinding]) -> bool:
        """Check security configuration"""
        config_findings = [f for f in findings if f.category == "configuration"]
        high_severity_config = [f for f in config_findings if f.severity in ["critical", "high"]]
        return len(high_severity_config) == 0
    
    async def _check_xss_protection(self, findings: List[SecurityFinding]) -> bool:
        """Check XSS protection"""
        xss_findings = [f for f in findings if "xss" in f.title.lower()]
        return len(xss_findings) == 0
    
    async def _check_deserialization(self, findings: List[SecurityFinding]) -> bool:
        """Check deserialization security"""
        deser_findings = [f for f in findings if "deserialization" in f.title.lower()]
        return len(deser_findings) == 0
    
    async def _check_known_vulns(self, findings: List[SecurityFinding]) -> bool:
        """Check for known vulnerabilities in dependencies"""
        vuln_findings = [f for f in findings if f.category == "dependencies"]
        critical_vulns = [f for f in vuln_findings if f.severity == "critical"]
        return len(critical_vulns) == 0
    
    async def _check_logging(self, findings: List[SecurityFinding]) -> bool:
        """Check logging implementation"""
        # This would need to be implemented based on actual logging configuration
        return True

class SecurityAuditor:
    """Main security auditor class"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.sql_scanner = SQLInjectionScanner(db_session)
        self.xss_scanner = XSSScanner()
        self.auth_scanner = AuthenticationScanner()
        self.config_scanner = ConfigurationScanner()
        self.dependency_scanner = DependencyScanner()
        self.compliance_checker = ComplianceChecker()
    
    async def run_full_audit(
        self,
        base_url: str,
        endpoints: List[str],
        requirements_files: Dict[str, str] = None
    ) -> AuditReport:
        """Run a comprehensive security audit"""
        all_findings = []
        
        logger.info("Starting comprehensive security audit")
        
        try:
            # SQL Injection scanning
            logger.info("Scanning for SQL injection vulnerabilities")
            sql_findings = await self.sql_scanner.scan_endpoints(base_url, endpoints)
            all_findings.extend(sql_findings)
            
            # XSS scanning
            logger.info("Scanning for XSS vulnerabilities")
            xss_findings = await self.xss_scanner.scan_endpoints(base_url, endpoints)
            all_findings.extend(xss_findings)
            
            # Authentication scanning
            logger.info("Scanning authentication mechanisms")
            auth_findings = await self.auth_scanner.scan_auth_endpoints(base_url)
            all_findings.extend(auth_findings)
            
            # Configuration scanning
            logger.info("Scanning security configuration")
            config_findings = await self.config_scanner.scan_security_headers(base_url)
            all_findings.extend(config_findings)
            
            # Dependency scanning
            if requirements_files:
                logger.info("Scanning dependencies for vulnerabilities")
                if "python" in requirements_files:
                    python_findings = await self.dependency_scanner.scan_python_dependencies(
                        requirements_files["python"]
                    )
                    all_findings.extend(python_findings)
                
                if "node" in requirements_files:
                    node_findings = await self.dependency_scanner.scan_node_dependencies(
                        requirements_files["node"]
                    )
                    all_findings.extend(node_findings)
            
            # Compliance checking
            logger.info("Checking compliance status")
            compliance_status = await self.compliance_checker.check_owasp_top10_compliance(all_findings)
            
            # Generate summary
            summary = self._generate_summary(all_findings)
            recommendations = self._generate_recommendations(all_findings)
            
            report = AuditReport(
                timestamp=datetime.utcnow(),
                scope=f"{base_url} with {len(endpoints)} endpoints",
                findings=all_findings,
                summary=summary,
                recommendations=recommendations,
                compliance_status=compliance_status
            )
            
            logger.info(f"Security audit completed. Found {len(all_findings)} issues.")
            
            # Log security audit completion
            log_security_event(
                logger,
                "security_audit_completed",
                details={
                    "findings_count": len(all_findings),
                    "critical_count": summary.get("critical", 0),
                    "high_count": summary.get("high", 0)
                }
            )
            
            return report
            
        except Exception as e:
            logger.error(f"Error during security audit: {e}")
            raise
    
    def _generate_summary(self, findings: List[SecurityFinding]) -> Dict[str, int]:
        """Generate findings summary by severity"""
        summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        
        for finding in findings:
            if finding.severity in summary:
                summary[finding.severity] += 1
        
        return summary
    
    def _generate_recommendations(self, findings: List[SecurityFinding]) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        if any(f.severity == "critical" for f in findings):
            recommendations.append("Immediately address all critical security vulnerabilities")
        
        if any("injection" in f.title.lower() for f in findings):
            recommendations.append("Implement parameterized queries and input validation")
        
        if any("xss" in f.title.lower() for f in findings):
            recommendations.append("Implement proper output encoding and CSP headers")
        
        if any(f.category == "authentication" for f in findings):
            recommendations.append("Review and strengthen authentication mechanisms")
        
        if any(f.category == "configuration" for f in findings):
            recommendations.append("Review and harden security configuration")
        
        if any(f.category == "dependencies" for f in findings):
            recommendations.append("Update vulnerable dependencies to latest secure versions")
        
        return recommendations
    
    async def save_report(self, report: AuditReport, file_path: str):
        """Save audit report to file"""
        report_data = {
            "timestamp": report.timestamp.isoformat(),
            "scope": report.scope,
            "findings": [asdict(finding) for finding in report.findings],
            "summary": report.summary,
            "recommendations": report.recommendations,
            "compliance_status": report.compliance_status
        }
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write(json.dumps(report_data, indent=2))
        
        logger.info(f"Security audit report saved to {file_path}")

# CLI interface for running security audits
async def main():
    """Main CLI interface for security auditing"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Off the Grid Security Auditor")
    parser.add_argument("--base-url", required=True, help="Base URL to audit")
    parser.add_argument("--endpoints", nargs="+", default=["/api/health"], help="Endpoints to scan")
    parser.add_argument("--python-requirements", help="Python requirements file path")
    parser.add_argument("--node-package", help="Node.js package.json file path")
    parser.add_argument("--output", default="audit_report.json", help="Output file path")
    
    args = parser.parse_args()
    
    # Setup requirements files
    requirements_files = {}
    if args.python_requirements:
        requirements_files["python"] = args.python_requirements
    if args.node_package:
        requirements_files["node"] = args.node_package
    
    # Create auditor (Note: This would need proper DB session in real usage)
    auditor = SecurityAuditor(None)  # Would need actual DB session
    
    # Run audit
    report = await auditor.run_full_audit(
        args.base_url,
        args.endpoints,
        requirements_files
    )
    
    # Save report
    await auditor.save_report(report, args.output)
    
    # Print summary
    print(f"\nSecurity Audit Complete!")
    print(f"Total findings: {len(report.findings)}")
    print(f"Critical: {report.summary['critical']}")
    print(f"High: {report.summary['high']}")
    print(f"Medium: {report.summary['medium']}")
    print(f"Low: {report.summary['low']}")
    print(f"\nReport saved to: {args.output}")

if __name__ == "__main__":
    asyncio.run(main())