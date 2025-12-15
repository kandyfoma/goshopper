"""
Product Normalization CLI Tool
Interactive command-line interface for testing and using the product normalization system
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict

from product_normalizer import ProductNormalizer
from translator import translator
from embeddings import semantic_matcher


class NormalizerCLI:
    """Command-line interface for product normalization"""
    
    def __init__(self):
        self.normalizer = ProductNormalizer()
        print("✓ Product Normalizer initialized")
        print(f"✓ Loaded {len(self.normalizer.master_products.get('products', []))} products")
        print(f"✓ Built index with {len(self.normalizer.product_index)} entries")
        print()
    
    def normalize_single(self, product_name: str, shop_id: str = None) -> None:
        """Normalize a single product name"""
        print(f"\n{'='*80}")
        print(f"Input: '{product_name}'")
        if shop_id:
            print(f"Shop: {shop_id}")
        print(f"{'='*80}")
        
        result = self.normalizer.normalize(product_name, shop_id)
        
        # Display results
        self._display_result(result)
    
    def normalize_batch(self, file_path: str) -> None:
        """Normalize a batch of products from a file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            items = data.get("items", [])
            if not items:
                print(f"❌ No items found in {file_path}")
                return
            
            print(f"\n{'='*80}")
            print(f"Processing {len(items)} items from {file_path}")
            print(f"{'='*80}\n")
            
            results = self.normalizer.normalize_batch(items)
            
            # Display results
            for idx, result in enumerate(results, 1):
                print(f"\n--- Item {idx}/{len(results)} ---")
                print(f"Input: {result.get('name', 'N/A')}")
                self._display_result(result["normalization"])
            
            # Save results
            output_file = Path(file_path).stem + "_normalized.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            
            print(f"\n✓ Results saved to: {output_file}")
            
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON in file: {file_path}")
        except Exception as e:
            print(f"❌ Error processing batch: {e}")
    
    def search_products(self, query: str, limit: int = 10) -> None:
        """Search for products"""
        print(f"\n{'='*80}")
        print(f"Searching for: '{query}'")
        print(f"{'='*80}\n")
        
        results = self.normalizer.search_products(query, limit)
        
        if not results:
            print("❌ No matches found")
            return
        
        print(f"Found {len(results)} matches:\n")
        for idx, product in enumerate(results, 1):
            print(f"{idx}. {product['normalized_name']}")
            print(f"   ID: {product['product_id']}")
            print(f"   Category: {product['category']}")
            print(f"   Score: {product['match_score']:.3f}")
            print(f"   Unit: {product['unit_of_measure']}")
            print()
    
    def add_product(self, name: str, category: str, unit: str = "piece") -> None:
        """Add a new product to the database"""
        print(f"\n{'='*80}")
        print(f"Adding new product: '{name}'")
        print(f"{'='*80}\n")
        
        # Collect aliases
        print("Enter French aliases (comma-separated, or press Enter to skip):")
        fr_input = input("> ").strip()
        aliases_fr = [a.strip() for a in fr_input.split(",")] if fr_input else []
        
        print("Enter English aliases (comma-separated, or press Enter to skip):")
        en_input = input("> ").strip()
        aliases_en = [a.strip() for a in en_input.split(",")] if en_input else []
        
        # Add product
        product_id = self.normalizer.add_product(
            normalized_name=name,
            category=category,
            unit_of_measure=unit,
            aliases_fr=aliases_fr,
            aliases_en=aliases_en
        )
        
        print(f"\n✓ Product added successfully!")
        print(f"  Product ID: {product_id}")
        print(f"  Name: {name}")
        print(f"  Category: {category}")
        print(f"  Unit: {unit}")
        print(f"  French aliases: {aliases_fr}")
        print(f"  English aliases: {aliases_en}")
    
    def learn_mapping(self, raw_name: str, product_id: str, shop_id: str = None) -> None:
        """Learn a new mapping"""
        print(f"\n{'='*80}")
        print(f"Learning mapping: '{raw_name}' → {product_id}")
        print(f"{'='*80}\n")
        
        success = self.normalizer.learn_mapping(raw_name, product_id, shop_id)
        
        if success:
            print("✓ Mapping learned successfully!")
            
            # Test the mapping
            result = self.normalizer.normalize(raw_name, shop_id)
            print("\n✓ Verification:")
            self._display_result(result)
        else:
            print("❌ Failed to learn mapping")
    
    def translate_text(self, text: str, direction: str = "auto") -> None:
        """Translate text"""
        print(f"\n{'='*80}")
        print(f"Translation: '{text}'")
        print(f"{'='*80}\n")
        
        if direction == "auto":
            detected = translator.detect_language(text)
            print(f"Detected language: {detected}")
            
            if detected == "fr":
                result = translator.translate_to_english(text)
                print(f"French → English: {result}")
            elif detected == "en":
                result = translator.translate_to_french(text)
                print(f"English → French: {result}")
            else:
                print("Could not determine language")
        elif direction == "fr-en":
            result = translator.translate_to_english(text)
            print(f"French → English: {result}")
        elif direction == "en-fr":
            result = translator.translate_to_french(text)
            print(f"English → French: {result}")
        
        # Show all variants
        variants = translator.get_all_variants(text)
        print(f"\nAll variants: {', '.join(variants)}")
    
    def interactive_mode(self) -> None:
        """Enter interactive mode"""
        print("\n" + "="*80)
        print("INTERACTIVE MODE")
        print("="*80)
        print("\nCommands:")
        print("  normalize <product_name>  - Normalize a product name")
        print("  search <query>            - Search for products")
        print("  translate <text>          - Translate text")
        print("  add                       - Add a new product (guided)")
        print("  help                      - Show this help")
        print("  quit                      - Exit")
        print("\n")
        
        while True:
            try:
                cmd = input(">>> ").strip()
                
                if not cmd:
                    continue
                
                parts = cmd.split(maxsplit=1)
                command = parts[0].lower()
                args = parts[1] if len(parts) > 1 else ""
                
                if command == "quit" or command == "exit":
                    print("\nGoodbye!")
                    break
                elif command == "help":
                    print("\nCommands:")
                    print("  normalize <product_name>")
                    print("  search <query>")
                    print("  translate <text>")
                    print("  add")
                    print("  quit")
                elif command == "normalize":
                    if args:
                        self.normalize_single(args)
                    else:
                        print("Usage: normalize <product_name>")
                elif command == "search":
                    if args:
                        self.search_products(args)
                    else:
                        print("Usage: search <query>")
                elif command == "translate":
                    if args:
                        self.translate_text(args)
                    else:
                        print("Usage: translate <text>")
                elif command == "add":
                    print("\nEnter product details:")
                    name = input("Normalized name: ").strip()
                    category = input("Category: ").strip()
                    unit = input("Unit of measure (default: piece): ").strip() or "piece"
                    if name and category:
                        self.add_product(name, category, unit)
                    else:
                        print("❌ Name and category are required")
                else:
                    print(f"Unknown command: {command}")
                    print("Type 'help' for available commands")
                    
            except KeyboardInterrupt:
                print("\n\nGoodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
    
    def _display_result(self, result: Dict) -> None:
        """Display normalization result"""
        # Status indicator
        if result["product_id"]:
            status = "✓ MATCHED"
            color = ""
        else:
            status = "❌ NO MATCH"
            color = ""
        
        print(f"\n{status}")
        print(f"  Product ID: {result['product_id']}")
        print(f"  Normalized: {result['normalized_name']}")
        print(f"  Confidence: {result['confidence']:.3f} ({result['confidence']*100:.1f}%)")
        print(f"  Method: {result['match_method']}")
        print(f"  Needs Review: {'Yes' if result['needs_review'] else 'No'}")
        
        if result["suggestions"]:
            print(f"\n  Suggestions ({len(result['suggestions'])}):")
            for idx, sug in enumerate(result["suggestions"][:3], 1):
                print(f"    {idx}. {sug['normalized_name']} (score: {sug['score']:.3f})")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Product Normalization CLI Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Normalize a single product
  python cli_normalizer.py normalize "Banane Plantain"
  
  # Search for products
  python cli_normalizer.py search banana
  
  # Process a batch file
  python cli_normalizer.py batch receipt_items.json
  
  # Translate text
  python cli_normalizer.py translate "pomme de terre"
  
  # Interactive mode
  python cli_normalizer.py interactive
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Normalize command
    normalize_parser = subparsers.add_parser("normalize", help="Normalize a product name")
    normalize_parser.add_argument("name", help="Product name to normalize")
    normalize_parser.add_argument("--shop", help="Shop ID for context")
    
    # Search command
    search_parser = subparsers.add_parser("search", help="Search for products")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--limit", type=int, default=10, help="Max results")
    
    # Batch command
    batch_parser = subparsers.add_parser("batch", help="Process a batch from file")
    batch_parser.add_argument("file", help="JSON file with items")
    
    # Add product command
    add_parser = subparsers.add_parser("add", help="Add a new product")
    add_parser.add_argument("name", help="Normalized product name")
    add_parser.add_argument("category", help="Product category")
    add_parser.add_argument("--unit", default="piece", help="Unit of measure")
    
    # Learn mapping command
    learn_parser = subparsers.add_parser("learn", help="Learn a new mapping")
    learn_parser.add_argument("raw_name", help="Raw product name")
    learn_parser.add_argument("product_id", help="Target product ID")
    learn_parser.add_argument("--shop", help="Shop ID")
    
    # Translate command
    translate_parser = subparsers.add_parser("translate", help="Translate text")
    translate_parser.add_argument("text", help="Text to translate")
    translate_parser.add_argument("--direction", choices=["auto", "fr-en", "en-fr"], 
                                 default="auto", help="Translation direction")
    
    # Interactive command
    subparsers.add_parser("interactive", help="Enter interactive mode")
    
    args = parser.parse_args()
    
    # Initialize CLI
    cli = NormalizerCLI()
    
    # Execute command
    if args.command == "normalize":
        cli.normalize_single(args.name, args.shop)
    elif args.command == "search":
        cli.search_products(args.query, args.limit)
    elif args.command == "batch":
        cli.normalize_batch(args.file)
    elif args.command == "add":
        cli.add_product(args.name, args.category, args.unit)
    elif args.command == "learn":
        cli.learn_mapping(args.raw_name, args.product_id, args.shop)
    elif args.command == "translate":
        cli.translate_text(args.text, args.direction)
    elif args.command == "interactive":
        cli.interactive_mode()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
