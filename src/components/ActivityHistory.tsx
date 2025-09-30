import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  MessageCircle, 
  Reply, 
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Clock,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare
} from 'lucide-react';
import { activityService } from '@/services/activityService';
import { ActivityHistoryItem, ActivityDisplayItem } from '@/types/activity';

interface ActivityHistoryProps {
  username: string;
  className?: string;
}

const ActivityHistory: React.FC<ActivityHistoryProps> = ({ username, className }) => {
  const [activities, setActivities] = useState<ActivityHistoryItem[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'posts' | 'comments' | 'replies'>('posts');
  const [limit, setLimit] = useState(20);
  const [activeTab, setActiveTab] = useState('all');

  const loadActivities = async () => {
    if (!username) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let data: ActivityHistoryItem[] = [];
      
      switch (activeTab) {
        case 'posts':
          data = await activityService.getUserPosts(username, limit);
          break;
        case 'comments':
          data = await activityService.getUserComments(username, limit);
          break;
        case 'replies':
          data = await activityService.getUserReplies(username, limit);
          break;
        default:
          data = await activityService.getAllUserActivity(username, Math.floor(limit / 3));
          break;
      }
      
      setActivities(data);
      setFilteredActivities(data);
    } catch (err) {
      setError('Failed to load activity history');
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [username, activeTab, limit]);

  useEffect(() => {
    let filtered = activities;

    // Filter by search term
    if (searchTerm) {
      filtered = activityService.searchActivities(activities, searchTerm);
    }

    setFilteredActivities(filtered);
  }, [activities, searchTerm]);

  const formatPayout = (payoutValue: string): string => {
    if (!payoutValue || payoutValue === '0.000 HIVE') return '0 HIVE';
    return payoutValue;
  };

  const getActivityIcon = (activity: ActivityHistoryItem) => {
    if (activity.parent_author === '') {
      return <FileText className="h-4 w-4" />;
    } else if (activity.depth === 1) {
      return <MessageCircle className="h-4 w-4" />;
    } else {
      return <Reply className="h-4 w-4" />;
    }
  };

  const getActivityType = (activity: ActivityHistoryItem): string => {
    if (activity.parent_author === '') {
      return 'Post';
    } else if (activity.depth === 1) {
      return 'Comment';
    } else {
      return 'Reply';
    }
  };

  const renderActivityCard = (activity: ActivityHistoryItem) => (
    <div
      key={`${activity.author}-${activity.permlink}`}
      className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">
            {getActivityIcon(activity)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={activity.parent_author === '' ? 'default' : 'secondary'}>
                {getActivityType(activity)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                in #{activity.category}
              </span>
            </div>
            
            <h3 className="font-medium text-lg leading-tight mb-2">
              {activity.title || 'Untitled'}
            </h3>
            
            <div className="text-sm text-muted-foreground mb-3">
              {activityService.truncateText(activity.body, 200)}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {activityService.getRelativeTime(activity.created)}
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {activity.net_votes} votes
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {activity.children} replies
              </div>
              <div className="flex items-center gap-1">
                <span>💰</span>
                {formatPayout(activity.total_payout_value)}
              </div>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(activity.url, '_blank')}
          className="flex-shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const summary = activityService.getActivitySummary(activities);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription>Loading activity history for @{username}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Activity History
        </CardTitle>
        <CardDescription>
          Activity history for @{username}
        </CardDescription>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.totalActivities}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.postsCount}</div>
            <div className="text-sm text-muted-foreground">Posts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.commentsCount}</div>
            <div className="text-sm text-muted-foreground">Comments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.totalVotes}</div>
            <div className="text-sm text-muted-foreground">Votes</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="replies" className="flex items-center gap-2">
              <Reply className="h-4 w-4" />
              Replies
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadActivities} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Activity List */}
        <div className="space-y-4">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activities found
            </div>
          ) : (
            filteredActivities.map(renderActivityCard)
          )}
        </div>

        {filteredActivities.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredActivities.length} of {activities.length} activities
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityHistory;
