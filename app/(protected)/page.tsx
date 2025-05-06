import { LucideDownload, LucideEye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { Button, DownloadButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tag } from "@/components/ui/tag";

import heroBanner from "@/public/hero-banner.png";

const domains = [
  {
    title: "Rheumatology",
    description: "Access EVA for rheumatology disease models.",
    samples: ["Blood", "Lacrimal"],
    diseases: ["Sjögren’s Syndrome", "Rheumatoid Arthritis"],
    button: { text: "Start", disabled: false },
  },
  {
    title: "Dermatology",
    description: "Access EVA for dermatology disease models.",
    samples: ["Blood", "Skin"],
    diseases: ["Psoriasis"],
    button: { text: "Available soon", disabled: true },
  },
  {
    title: "Gastroenterology",
    description: "Access EVA for gastro-enterology disease models.",
    samples: ["Blood", "Digestive"],
    diseases: ["Crohn’s Disease"],
    button: { text: "Available soon", disabled: true },
  },
  {
    title: "Personalized",
    description: "Access EVA by personalizing your sample type and disease.",
    samples: ["Blood", "Skin"],
    diseases: ["Sjögren’s Syndrome"],
    button: { text: "Available soon", disabled: true },
  },
];

const simulations = [
  {
    id: 1,
    name: "Blood Transcriptome Analysis in Sjögren’s Syndrome",
    author: "Scienta Lab",
    tags: ["BLOOD", "Sjögren’s Syndrome"],
    date: "April 11 2025",
  },
  {
    id: 2,
    name: "Lacrimal Gland Immune Profiling",
    author: "Scienta Lab",
    tags: ["Lacrimal", "Sjögren’s Syndrome"],
    date: "March 28 2025",
  },
  {
    id: 3,
    name: "Skin Lesion Gene Expression in Psoriasis",
    author: "Scienta Lab",
    tags: ["Skin", "Psoriasis"],
    date: "February 15 2025",
  },
  {
    id: 4,
    name: "Digestive Tract Inflammation in Crohn’s Disease",
    author: "Scienta Lab",
    tags: ["Digestive", "Crohn’s Disease"],
    date: "January 30 2025",
  },
  {
    id: 5,
    name: "Blood Biomarker Discovery in Rheumatoid Arthritis",
    author: "Scienta Lab",
    tags: ["BLOOD", "Rheumatoid Arthritis"],
    date: "January 12 2025",
  },
  {
    id: 6,
    name: "Personalized Immune Response Simulation",
    author: "Scienta Lab",
    tags: ["BLOOD", "Skin", "Custom"],
    date: "March 3 2025",
  },
];

export default function Home() {
  return (
    <>
      <AppHeader />
      <div className="mt-10 mb-40 space-y-10">
        <header className="mx-auto max-w-6xl space-y-4 px-10 pt-6">
          <h1 className="text-2xl font-semibold">
            Launch a simulation with Eva
          </h1>
          <p className="max-w-prose text-base text-gray-400">
            Access to EVA, our multi-modal model that captures the complexity
            and variability of the immune system to create your gene regulatory
            network, and investigate association with clinical outcomes.
          </p>
        </header>
        <section className="stack mx-auto mb-30 max-w-6xl px-10">
          <Image
            alt="Banner illustration"
            src={heroBanner}
            width={500}
            height={150}
            unoptimized
            className="-z-50 h-[330px] w-full rounded-2xl object-cover opacity-70"
          />

          <div className="mt-[115px] flex h-full justify-around gap-6 px-10">
            {domains.map((domain) => (
              <Card
                key={domain.title}
                className="flex h-98 w-55 flex-col justify-between bg-white shadow-2xl"
              >
                <CardHeader className="space-y-2 px-4">
                  <CardTitle className="text-base">{domain.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {domain.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 px-4">
                  <MultiSelect
                    name="Samples"
                    options={domain.samples}
                    placeholder="Choose a sample"
                  />
                  <MultiSelect
                    name="Diseases"
                    options={domain.diseases}
                    placeholder="Choose a disease"
                  />
                </CardContent>
                <CardFooter className="px-4">
                  <Link href="/chat" className="contents">
                    <Button
                      className="bg-primary hover:bg-primary/90 w-full font-bold"
                      disabled={domain.button.disabled}
                    >
                      {domain.button.text}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl space-y-8 px-10">
          <h3 className="text-2xl font-semibold">Browse simulations</h3>

          <div className="flex flex-wrap gap-x-2 gap-y-2">
            {simulations.map((simulation) => (
              <div
                key={simulation.id}
                className="flex max-w-[25ch] flex-col justify-between rounded-xl border-2 border-gray-200 bg-white p-5 transition-transform hover:scale-110"
              >
                <span>
                  <h4 className="text-sm font-semibold">{simulation.name}</h4>
                  <div className="mt-2 mb-5 flex flex-wrap gap-1">
                    {simulation.tags.map((tag, idx) => (
                      <Tag key={idx} className="text-tiny truncate">
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </span>
                <div className="flex items-center justify-between">
                  <div className="-ml-2 flex items-center gap-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="h-auto bg-transparent py-2 text-gray-600 shadow-none hover:bg-gray-100 has-[>svg]:px-2">
                          <LucideEye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="aspect-[225/297] h-full max-h-[95vh] w-auto max-w-none overflow-hidden p-0 sm:max-w-none">
                        <DialogTitle className="sr-only">PDF</DialogTitle>
                        {/* TODO: Why is this not closing on ESC press ? */}
                        <iframe
                          src="/example.pdf#toolbar=0"
                          className="h-full w-full scale-[101.5%] border-none"
                        ></iframe>
                      </DialogContent>
                    </Dialog>
                    <DownloadButton
                      name={`${simulation.name}.pdf`}
                      href="/example.pdf"
                      className="h-auto bg-transparent py-2 text-gray-600 shadow-none hover:bg-gray-100 has-[>svg]:px-2"
                    >
                      <LucideDownload className="h-4 w-4" />
                    </DownloadButton>
                  </div>

                  <div className="text-tiny text-right text-gray-600 italic">
                    <p>{simulation.author}</p>
                    <p>{simulation.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mx-auto flex max-w-6xl items-center justify-center px-10 py-5">
          <p className="text-sm text-gray-400">© 2025 Scienta Lab</p>
        </footer>
      </div>
    </>
  );
}
