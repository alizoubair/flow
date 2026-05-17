import {
  Hammer,
  CheckCircle,
  Shield,
  Rocket,
  Package,
  Bug,
  Sparkles,
  Container,
  Upload
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface StageType {
  type: string;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export interface TaskType {
  type: string;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const STAGE_TYPES: StageType[] = [
  { type: 'stage-build', label: 'Build Stage', icon: Hammer, color: '#10B981', description: 'Compile and package code' },
  { type: 'stage-test', label: 'Test Stage', icon: CheckCircle, color: '#3B82F6', description: 'Run tests and quality checks' },
  { type: 'stage-security', label: 'Security Stage', icon: Shield, color: '#EF4444', description: 'Security scans and audits' },
  { type: 'stage-deploy', label: 'Deploy Stage', icon: Rocket, color: '#F59E0B', description: 'Deploy to environments' },
];

export const TASK_TYPES: TaskType[] = [
  { type: 'install', label: 'Install', icon: Package, color: '#10B981', description: 'Install dependencies' },
  { type: 'build', label: 'Build', icon: Hammer, color: '#3B82F6', description: 'Build application' },
  { type: 'test', label: 'Test', icon: Bug, color: '#8B5CF6', description: 'Run tests' },
  { type: 'lint', label: 'Lint', icon: Sparkles, color: '#F59E0B', description: 'Code linting' },
  { type: 'security', label: 'Security Scan', icon: Shield, color: '#EF4444', description: 'Security analysis' },
  { type: 'docker', label: 'Docker Build', icon: Container, color: '#2563EB', description: 'Build container' },
  { type: 'deploy', label: 'Deploy', icon: Upload, color: '#10B981', description: 'Deploy application' },
];

// Helper to get icon map for components
export const STAGE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  STAGE_TYPES.map(stage => [stage.type, stage.icon])
);
