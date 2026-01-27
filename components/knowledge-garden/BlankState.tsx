import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Cpu, Network } from "lucide-react";

interface BlankStateProps {
  onUpload: () => void;
}

export function BlankState({ onUpload }: BlankStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Welcome to Your Knowledge Garden
        </h1>
        <p className="text-muted-foreground text-lg">
          Transform your documents into an interactive knowledge graph. Upload your files, and we'll handle the rest.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <Card className="bg-muted/50 border-dashed hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4 mx-auto">
              <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>1. Upload</CardTitle>
            <CardDescription>
              Drag & drop PDFs, images, or audio files.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-muted/50 border-dashed hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-4 mx-auto">
              <Cpu className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle>2. Process</CardTitle>
            <CardDescription>
              AI extracts text, chunks it, and generates embeddings.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-muted/50 border-dashed hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4 mx-auto">
              <Network className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>3. Connect</CardTitle>
            <CardDescription>
              We automatically link related concepts in a graph.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Button size="lg" onClick={onUpload} className="mt-8 text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all">
        <Upload className="mr-2 h-5 w-5" />
        Plant Your First Seed
      </Button>
    </div>
  );
}
